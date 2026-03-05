//! Handlers for the Google Home / IFTTT Webhook integration.
//!
//! Architecture:
//!   1. User generates a personal API key via `POST /api/integrations/generate-key`.
//!   2. User pastes that key + the webhook URL into an IFTTT Applet.
//!   3. When Google Home triggers the applet, IFTTT posts to
//!      `POST /api/integrations/ifttt-webhook` with the key in the Authorization header.
//!
//! Supported actions:
//!   add_todo_item  — add item (with date + recurrence) to a todo list
//!   add_item       — add a plain item to any list
//!   create_list    — create a new list owned by the user
//!   mark_todo_done — complete a generated todo-occurrence
//!   mark_item_done — tick off a shopping/general list item
//!   add_expense    — log an expense (stub, wire up DB writes below)
//!   check_balance  — read balance (stub)
//!
//! Routes registered in `main.rs`:
//!   POST /api/integrations/generate-key  — authenticated via user_id query param
//!   POST /api/integrations/ifttt-webhook — public, authenticated by webhook API key

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::AppState;
use crate::models::{IftttWebhookRequest, ListItem, UserList};

// ── Shared response helpers ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct GenerateKeyResponse {
    api_key: String,
}

#[derive(Debug, Serialize)]
struct WebhookResponse {
    message: String,
    action: String,
}

// ── Query param for generate-key ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct GenerateKeyQuery {
    pub user_id: String,
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn new_item_id() -> String {
    ObjectId::new().to_hex()
}

fn new_share_token() -> String {
    ObjectId::new().to_hex()
}

/// Resolve a list ObjectId from either an explicit `list_id` hex string or by
/// searching for a list owned by/accessible to `user_id` whose name matches
/// `list_name` (case-insensitive substring).
///
/// Returns `Ok(Some(oid))` on success, `Ok(None)` when not found,
/// `Err(msg)` on a DB error or bad ObjectId.
async fn resolve_list_id(
    data: &web::Data<AppState>,
    list_id: Option<&str>,
    list_name: Option<&str>,
    user_id: &str,
) -> Result<Option<ObjectId>, String> {
    if let Some(id_str) = list_id {
        return ObjectId::parse_str(id_str)
            .map(Some)
            .map_err(|_| format!("Invalid listId '{}'", id_str));
    }
    if let Some(name) = list_name {
        let filter = doc! {
            "name": { "$regex": name, "$options": "i" },
            "$or": [{ "ownerId": user_id }, { "authorizedUsers": user_id }]
        };
        let opts = mongodb::options::FindOneOptions::builder()
            .sort(doc! { "createdAt": -1 })
            .build();
        return data
            .lists_collection
            .find_one(filter, opts)
            .await
            .map(|opt| opt.and_then(|l| l.id))
            .map_err(|e| e.to_string());
    }
    Ok(None)
}

// ── POST /api/integrations/generate-key ──────────────────────────────────────

/// Generates a cryptographically random 64-character API key (two UUID v4s,
/// hyphens stripped) and stores it on the user's MongoDB document.
///
/// Query params:
///   - `user_id` (required) — MongoDB hex ObjectId of the calling user.
///
/// Returns:
///   200 `{ "api_key": "<64-char-hex-string>" }`
///   400 if `user_id` is malformed
///   404 if no user with that ID exists
pub async fn generate_webhook_key(
    query: web::Query<GenerateKeyQuery>,
    data: web::Data<AppState>,
) -> impl Responder {
    let object_id = match ObjectId::parse_str(&query.user_id) {
        Ok(oid) => oid,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "error": "Invalid user_id format" }))
        }
    };

    // 128 bits of randomness — suitable for a long-lived bearer token.
    let api_key = format!(
        "{}{}",
        Uuid::new_v4().to_string().replace('-', ""),
        Uuid::new_v4().to_string().replace('-', "")
    );

    let result = data
        .users_collection
        .update_one(
            doc! { "_id": object_id },
            doc! { "$set": { "webhookApiKey": &api_key } },
            None,
        )
        .await;

    match result {
        Ok(r) if r.matched_count == 0 => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": "User not found" }))
        }
        Ok(_) => HttpResponse::Ok().json(GenerateKeyResponse { api_key }),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/integrations/ifttt-webhook ─────────────────────────────────────

/// Public fulfillment endpoint called by IFTTT when a Google Home command fires.
///
/// Authentication: `Authorization: Bearer <api_key>`
pub async fn ifttt_webhook(
    req: HttpRequest,
    data: web::Data<AppState>,
    body: web::Json<IftttWebhookRequest>,
) -> impl Responder {
    // ── 1. Extract the API key from "Authorization: Bearer <key>" ────────────
    let api_key = match req.headers().get("Authorization") {
        Some(value) => {
            let raw = match value.to_str() {
                Ok(s) => s,
                Err(_) => {
                    return HttpResponse::Unauthorized().json(
                        serde_json::json!({ "error": "Invalid Authorization header encoding" }),
                    )
                }
            };
            raw.strip_prefix("Bearer ").unwrap_or(raw).trim().to_string()
        }
        None => {
            return HttpResponse::Unauthorized()
                .json(serde_json::json!({ "error": "Missing Authorization header" }))
        }
    };

    if api_key.is_empty() {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({ "error": "Empty API key" }));
    }

    // ── 2. Resolve the user by their webhook API key ──────────────────────────
    let user = match data
        .users_collection
        .find_one(doc! { "webhookApiKey": &api_key }, None)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return HttpResponse::Unauthorized()
                .json(serde_json::json!({ "error": "Invalid API key" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let user_id = match &user.id {
        Some(oid) => oid.to_hex(),
        None => return HttpResponse::InternalServerError().body("User record has no _id"),
    };

    // ── 3. Dispatch on action ─────────────────────────────────────────────────
    let action = body.action.trim().to_lowercase();

    let response_message: String = match action.as_str() {

        // ── add_todo_item ─────────────────────────────────────────────────────
        // Adds a new item to an existing todo list.
        // Optional: completeByDate (YYYY-MM-DD or RFC3339), repeatFrequency.
        // When provided, these are also written to the list document itself so
        // the scheduler picks them up on the next generate-occurrences run.
        "add_todo_item" => {
            let text = match body.text.as_deref().filter(|s| !s.is_empty()) {
                Some(t) => t.to_string(),
                None => {
                    return HttpResponse::BadRequest()
                        .json(serde_json::json!({ "error": "add_todo_item requires 'text'" }))
                }
            };

            let list_oid = match resolve_list_id(
                &data,
                body.list_id.as_deref(),
                body.list_name.as_deref(),
                &user_id,
            )
            .await
            {
                Ok(Some(oid)) => oid,
                Ok(None) => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "Could not find a list — provide listId or listName"
                    }))
                }
                Err(e) => return HttpResponse::InternalServerError().body(e),
            };

            let new_item = ListItem {
                id: new_item_id(),
                text: text.clone(),
                completed: false,
                completed_by_user_id: None,
                last_completed_at: None,
                last_completed_by_user_id: None,
                created_at: Utc::now(),
                sub_items: vec![],
            };

            let item_doc = match mongodb::bson::to_document(&new_item) {
                Ok(d) => d,
                Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
            };

            // Optional list-level fields (recurrence + due date).
            let mut set_doc = doc! {};
            if let Some(rf) = body.repeat_frequency.as_deref().filter(|s| !s.is_empty()) {
                set_doc.insert("repeatFrequency", rf);
            }
            if let Some(cbd) = body.complete_by_date.as_deref().filter(|s| !s.is_empty()) {
                // Accept both RFC3339 and bare YYYY-MM-DD.
                let parsed = chrono::DateTime::parse_from_rfc3339(cbd).ok().or_else(|| {
                    chrono::DateTime::parse_from_rfc3339(&format!("{}T00:00:00Z", cbd)).ok()
                });
                if let Some(dt) = parsed {
                    set_doc.insert(
                        "completeByDate",
                        mongodb::bson::DateTime::from_millis(dt.timestamp_millis()),
                    );
                }
            }

            let mut update = doc! { "$push": { "items": item_doc } };
            if !set_doc.is_empty() {
                update.insert("$set", set_doc);
            }

            if let Err(e) = data
                .lists_collection
                .update_one(doc! { "_id": list_oid }, update, None)
                .await
            {
                return HttpResponse::InternalServerError().body(e.to_string());
            }

            format!("Got it! I added '{}' to your list.", text)
        }

        // ── add_item ──────────────────────────────────────────────────────────
        // Adds a plain item to any list type (shopping, general, todo).
        "add_item" => {
            let text = match body.text.as_deref().filter(|s| !s.is_empty()) {
                Some(t) => t.to_string(),
                None => {
                    return HttpResponse::BadRequest()
                        .json(serde_json::json!({ "error": "add_item requires 'text'" }))
                }
            };

            let list_oid = match resolve_list_id(
                &data,
                body.list_id.as_deref(),
                body.list_name.as_deref(),
                &user_id,
            )
            .await
            {
                Ok(Some(oid)) => oid,
                Ok(None) => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "Could not find a list — provide listId or listName"
                    }))
                }
                Err(e) => return HttpResponse::InternalServerError().body(e),
            };

            let new_item = ListItem {
                id: new_item_id(),
                text: text.clone(),
                completed: false,
                completed_by_user_id: None,
                last_completed_at: None,
                last_completed_by_user_id: None,
                created_at: Utc::now(),
                sub_items: vec![],
            };

            let item_doc = match mongodb::bson::to_document(&new_item) {
                Ok(d) => d,
                Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
            };

            if let Err(e) = data
                .lists_collection
                .update_one(
                    doc! { "_id": list_oid },
                    doc! { "$push": { "items": item_doc } },
                    None,
                )
                .await
            {
                return HttpResponse::InternalServerError().body(e.to_string());
            }

            format!("Got it! I added '{}' to your list.", text)
        }

        // ── create_list ───────────────────────────────────────────────────────
        // Creates a new list owned by the webhook user.
        // Payload: text (name), listType (todo/shopping/general),
        //          completeByDate?, repeatFrequency?
        "create_list" => {
            let name = match body.text.as_deref().filter(|s| !s.is_empty()) {
                Some(n) => n.to_string(),
                None => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "create_list requires 'text' (the list name)"
                    }))
                }
            };

            let list_type = body
                .list_type
                .as_deref()
                .filter(|s| !s.is_empty())
                .unwrap_or("todo")
                .to_string();

            let complete_by_date = body
                .complete_by_date
                .as_deref()
                .filter(|s| !s.is_empty())
                .and_then(|cbd| {
                    chrono::DateTime::parse_from_rfc3339(cbd).ok().or_else(|| {
                        chrono::DateTime::parse_from_rfc3339(&format!("{}T00:00:00Z", cbd)).ok()
                    })
                })
                .map(|dt| dt.with_timezone(&Utc));

            let new_list = UserList {
                id: None,
                name: name.clone(),
                list_type,
                owner_id: user_id.clone(),
                created_by_user_id: user_id.clone(),
                authorized_users: vec![user_id.clone()],
                items: vec![],
                share_token: new_share_token(),
                created_at: Utc::now(),
                complete_by_date,
                repeat_frequency: body.repeat_frequency.clone(),
            };

            match data.lists_collection.insert_one(new_list, None).await {
                Ok(_) => format!("Got it! I created a new list called '{}'.", name),
                Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
            }
        }

        // ── mark_todo_done ────────────────────────────────────────────────────
        // Marks a generated todo-occurrence as completed (toggles).
        //
        // Resolution priority:
        //   1. occurrenceId  (direct hex ObjectId of the todo_occurrence doc)
        //   2. text + date   (fuzzy search: ownerId + itemText icontains + occurrenceDate)
        //      optionally narrowed by listId or listName
        "mark_todo_done" => {
            let occ_oid: Option<ObjectId> = body
                .occurrence_id
                .as_deref()
                .and_then(|s| ObjectId::parse_str(s).ok());

            let resolved_oid: ObjectId = if let Some(oid) = occ_oid {
                oid
            } else {
                let text_filter = body.text.as_deref().filter(|s| !s.is_empty());
                let date_filter = body.date.as_deref().filter(|s| !s.is_empty());

                if text_filter.is_none() && date_filter.is_none() {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "mark_todo_done requires 'occurrenceId' OR ('text' + 'date')"
                    }));
                }

                let mut filter = doc! { "ownerId": &user_id };
                if let Some(d) = date_filter {
                    filter.insert("occurrenceDate", d);
                }
                if let Some(t) = text_filter {
                    filter.insert("itemText", doc! { "$regex": t, "$options": "i" });
                }
                // Optionally restrict to a specific list.
                if let Some(lid) = body.list_id.as_deref() {
                    filter.insert("listId", lid);
                } else if let Some(ln) = body.list_name.as_deref().filter(|s| !s.is_empty()) {
                    filter.insert("listName", doc! { "$regex": ln, "$options": "i" });
                }

                match data
                    .todo_occurrences_collection
                    .find_one(filter, None)
                    .await
                {
                    Ok(Some(occ)) => match occ.id {
                        Some(oid) => oid,
                        None => {
                            return HttpResponse::InternalServerError()
                                .body("Occurrence has no _id")
                        }
                    },
                    Ok(None) => {
                        return HttpResponse::NotFound().json(serde_json::json!({
                            "error": "No matching todo occurrence found"
                        }))
                    }
                    Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
                }
            };

            // Fetch current state to determine toggle direction.
            let current = match data
                .todo_occurrences_collection
                .find_one(doc! { "_id": resolved_oid }, None)
                .await
            {
                Ok(Some(o)) => o,
                Ok(None) => {
                    return HttpResponse::NotFound()
                        .json(serde_json::json!({ "error": "Occurrence not found" }))
                }
                Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
            };

            let item_text = current.item_text.clone();
            let marking_done = !current.completed;

            let update = if marking_done {
                doc! { "$set": {
                    "completed": true,
                    "completedByUserId": &user_id,
                    "completedAt": mongodb::bson::DateTime::from_millis(
                        Utc::now().timestamp_millis()
                    ),
                }}
            } else {
                doc! {
                    "$set": { "completed": false },
                    "$unset": { "completedByUserId": "", "completedAt": "", "completedByName": "" }
                }
            };

            if let Err(e) = data
                .todo_occurrences_collection
                .update_one(doc! { "_id": resolved_oid }, update, None)
                .await
            {
                return HttpResponse::InternalServerError().body(e.to_string());
            }

            if marking_done {
                format!("Got it! I marked '{}' as done.", item_text)
            } else {
                format!("Got it! I un-marked '{}' as done.", item_text)
            }
        }

        // ── mark_item_done ────────────────────────────────────────────────────
        // Ticks off (or un-ticks) a shopping / general list item.
        //
        // Resolution priority:
        //   1. listId + itemId  (exact)
        //   2. listId/listName + text  (case-insensitive substring match)
        "mark_item_done" => {
            let list_oid = match resolve_list_id(
                &data,
                body.list_id.as_deref(),
                body.list_name.as_deref(),
                &user_id,
            )
            .await
            {
                Ok(Some(oid)) => oid,
                Ok(None) => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "mark_item_done requires listId or listName"
                    }))
                }
                Err(e) => return HttpResponse::InternalServerError().body(e),
            };

            // Fetch list to locate the target item.
            let list = match data
                .lists_collection
                .find_one(doc! { "_id": list_oid }, None)
                .await
            {
                Ok(Some(l)) => l,
                Ok(None) => {
                    return HttpResponse::NotFound()
                        .json(serde_json::json!({ "error": "List not found" }))
                }
                Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
            };

            let item = if let Some(iid) = body.item_id.as_deref() {
                list.items.into_iter().find(|i| i.id == iid)
            } else if let Some(txt) = body.text.as_deref().filter(|s| !s.is_empty()) {
                let lower = txt.to_lowercase();
                list.items
                    .into_iter()
                    .find(|i| i.text.to_lowercase().contains(&lower))
            } else {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "mark_item_done requires 'itemId' or 'text'"
                }));
            };

            let item = match item {
                Some(i) => i,
                None => {
                    return HttpResponse::NotFound()
                        .json(serde_json::json!({ "error": "Item not found in that list" }))
                }
            };

            let marking_done = !item.completed;
            let item_id = item.id.clone();
            let item_text = item.text.clone();

            let mut set_fields = doc! { "items.$[elem].completed": marking_done };
            if marking_done {
                set_fields.insert("items.$[elem].completedByUserId", user_id.as_str());
            } else {
                set_fields
                    .insert("items.$[elem].completedByUserId", mongodb::bson::Bson::Null);
            }

            let options = mongodb::options::UpdateOptions::builder()
                .array_filters(vec![doc! { "elem.id": { "$eq": &item_id } }])
                .build();

            if let Err(e) = data
                .lists_collection
                .update_one(
                    doc! { "_id": list_oid },
                    doc! { "$set": set_fields },
                    options,
                )
                .await
            {
                return HttpResponse::InternalServerError().body(e.to_string());
            }

            if marking_done {
                format!("Got it! I marked '{}' as done.", item_text)
            } else {
                format!("Got it! I un-checked '{}' on your list.", item_text)
            }
        }

        // ── add_expense ───────────────────────────────────────────────────────
        // TODO: Insert a record into `data.generated_transactions_collection`
        //       scoped to `user_id`.
        "add_expense" => {
            let amount = body.amount.unwrap_or(0.0);
            let category = body.category.as_deref().unwrap_or("general");
            eprintln!(
                "[webhook] add_expense: user={} amount={} category={}",
                user_id, amount, category
            );
            format!("Got it! I logged a ${:.2} expense under '{}'.", amount, category)
        }

        // ── check_balance ─────────────────────────────────────────────────────
        // TODO: Query data.generated_transactions_collection and sum amounts.
        "check_balance" => {
            eprintln!("[webhook] check_balance: user={}", user_id);
            "Balance check isn't wired up yet — coming soon!".to_string()
        }

        // ── unknown ───────────────────────────────────────────────────────────
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Unknown action '{}'", body.action),
                "supported": [
                    "add_todo_item", "add_item", "create_list",
                    "mark_todo_done", "mark_item_done",
                    "add_expense", "check_balance"
                ]
            }));
        }
    };

    HttpResponse::Ok().json(WebhookResponse {
        message: response_message,
        action: body.action.clone(),
    })
}

