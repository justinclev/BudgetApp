// ══════════════════════════════════════════════════════════════════════════
// handlers/voice_handler.rs
//
// Voice-assistant integration layer for Google Assistant, Amazon Alexa,
// and Apple Siri Shortcuts.
//
// HOW IT WORKS
// ─────────────
// All three platforms translate their native webhook format into a single
// internal VoiceCommand value, then call execute_command() which performs
// the actual MongoDB work.  The result is translated back to whatever
// envelope format each platform requires.
//
// ENDPOINTS
// ─────────
//   POST /api/voice/command   ← Siri Shortcuts / any direct REST caller
//   POST /api/voice/alexa     ← Amazon Alexa Custom Skill webhook
//   POST /api/voice/google    ← Google Actions / Dialogflow CX webhook
//
// SUPPORTED INTENTS (same across all three platforms)
// ─────────────────────────────────────────────────────
//   add_item        — add an item to a named list
//   check_off_item  — mark a list item done by its text
//   create_list     — create a new list (type: shopping | todo | other)
//   complete_todo   — mark today's todo occurrence as complete
//
// AUTHENTICATION
// ──────────────
// Siri Shortcuts  : send { "userId": "your-user-id" } in the JSON body
//                   (copy your ID from the app profile).
// Alexa           : configure Account Linking in the Alexa Developer Console.
//                   After linking, Alexa puts your userId in
//                   context.System.user.accessToken.
// Google          : after Account Linking, Google puts your userId in
//                   originalDetectIntentRequest.payload.user.accessToken.
// ══════════════════════════════════════════════════════════════════════════

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use chrono::Utc;
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::db::AppState;
use crate::models::{ListItem, UserList};

// ── Token auth helper ───────────────────────────────────────────────────────
//
// All voice endpoints accept ?token=<voiceToken> instead of a raw userId.
// This hides the internal user ID from users entirely.

async fn resolve_user_id_from_token(data: &AppState, token: &str) -> Option<String> {
    data.users_collection
        .find_one(doc! { "voiceToken": token }, None)
        .await
        .ok()
        .flatten()
        .and_then(|u| u.id.map(|oid| oid.to_hex()))
}

// ── Internal normalised command ────────────────────────────────────────────

/// Everything the voice layer needs after parsing any platform's webhook.
enum VoiceCommand {
    /// "Add milk to my Groceries list"
    AddItem {
        user_id: String,
        list_name: String,
        item_text: String,
    },
    /// "Check off milk in my Groceries list"
    CheckOffItem {
        user_id: String,
        list_name: String,
        item_text: String,
    },
    /// "Create a new shopping list called Groceries"
    CreateList {
        user_id: String,
        list_name: String,
        list_type: String, // "shopping" | "todo" | "other"
    },
    /// "Mark buy coffee as done in my Morning Routine todo"
    CompleteTodo {
        user_id: String,
        list_name: String,
        item_text: String,
    },
}

/// Human-readable outcome returned by execute_command().
struct VoiceResult {
    success: bool,
    message: String,
}

// ── Core executor  ─────────────────────────────────────────────────────────
//
// This is the ONLY place that touches MongoDB.  All three platform handlers
// build a VoiceCommand and call this — no business logic lives elsewhere.

async fn execute_command(data: &AppState, cmd: VoiceCommand) -> VoiceResult {
    match cmd {
        // ── add_item ────────────────────────────────────────────────────
        VoiceCommand::AddItem {
            user_id,
            list_name,
            item_text,
        } => {
            let list = match find_list_for_user(data, &user_id, &list_name).await {
                Some(l) => l,
                None => {
                    return VoiceResult {
                        success: false,
                        message: format!("I couldn't find a list called \"{}\".", list_name),
                    }
                }
            };

            let list_id = match &list.id {
                Some(id) => *id,
                None => {
                    return VoiceResult {
                        success: false,
                        message: "Unexpected error: list has no ID.".to_string(),
                    }
                }
            };

            let new_item = ListItem {
                id: ObjectId::new().to_hex(),
                text: item_text.clone(),
                completed: false,
                completed_by_user_id: None,
                last_completed_at: None,
                last_completed_by_user_id: None,
                created_at: Utc::now(),
                sub_items: vec![],
            };

            let item_doc = match mongodb::bson::to_document(&new_item) {
                Ok(d) => d,
                Err(e) => {
                    return VoiceResult {
                        success: false,
                        message: format!("Serialization error: {e}"),
                    }
                }
            };

            match data
                .lists_collection
                .update_one(
                    doc! { "_id": list_id },
                    doc! { "$push": { "items": item_doc } },
                    None,
                )
                .await
            {
                Ok(_) => VoiceResult {
                    success: true,
                    message: format!("Added \"{item_text}\" to {list_name}."),
                },
                Err(e) => VoiceResult {
                    success: false,
                    message: format!("Database error: {e}"),
                },
            }
        }

        // ── check_off_item ──────────────────────────────────────────────
        VoiceCommand::CheckOffItem {
            user_id,
            list_name,
            item_text,
        } => {
            let list = match find_list_for_user(data, &user_id, &list_name).await {
                Some(l) => l,
                None => {
                    return VoiceResult {
                        success: false,
                        message: format!("I couldn't find a list called \"{}\".", list_name),
                    }
                }
            };

            let list_id = match &list.id {
                Some(id) => *id,
                None => {
                    return VoiceResult {
                        success: false,
                        message: "Unexpected error: list has no ID.".to_string(),
                    }
                }
            };

            // Find the item by case-insensitive text match
            let item = list.items.iter().find(|i| {
                i.text.to_lowercase().contains(&item_text.to_lowercase()) && !i.completed
            });

            let item_id = match item {
                Some(i) => i.id.clone(),
                None => {
                    return VoiceResult {
                        success: false,
                        message: format!(
                            "I couldn't find an incomplete item matching \"{}\" in {}.",
                            item_text, list_name
                        ),
                    }
                }
            };

            let update = doc! {
                "$set": {
                    "items.$[elem].completed": true,
                    "items.$[elem].completedByUserId": &user_id,
                }
            };
            let array_filters = vec![doc! { "elem.id": { "$eq": &item_id } }];
            let options = mongodb::options::FindOneAndUpdateOptions::builder()
                .array_filters(array_filters)
                .build();

            match data
                .lists_collection
                .find_one_and_update(doc! { "_id": list_id }, update, options)
                .await
            {
                Ok(Some(_)) => VoiceResult {
                    success: true,
                    message: format!("Checked off \"{item_text}\" in {list_name}."),
                },
                Ok(None) => VoiceResult {
                    success: false,
                    message: "List not found.".to_string(),
                },
                Err(e) => VoiceResult {
                    success: false,
                    message: format!("Database error: {e}"),
                },
            }
        }

        // ── create_list ─────────────────────────────────────────────────
        VoiceCommand::CreateList {
            user_id,
            list_name,
            list_type,
        } => {
            let valid_type = match list_type.to_lowercase().as_str() {
                "shopping" => "shopping",
                "todo" => "todo",
                _ => "other",
            };

            let new_list = UserList {
                id: None,
                name: list_name.clone(),
                list_type: valid_type.to_string(),
                owner_id: user_id.clone(),
                created_by_user_id: user_id.clone(),
                authorized_users: vec![user_id],
                items: vec![],
                share_token: ObjectId::new().to_hex(),
                created_at: Utc::now(),
                complete_by_date: None,
                repeat_frequency: None,
            };

            match data.lists_collection.insert_one(new_list, None).await {
                Ok(_) => VoiceResult {
                    success: true,
                    message: format!("Created a new {valid_type} list called \"{list_name}\"."),
                },
                Err(e) => VoiceResult {
                    success: false,
                    message: format!("Database error: {e}"),
                },
            }
        }

        // ── complete_todo ────────────────────────────────────────────────
        VoiceCommand::CompleteTodo {
            user_id,
            list_name,
            item_text,
        } => {
            // Find the list first (to confirm ownership)
            let list = match find_list_for_user(data, &user_id, &list_name).await {
                Some(l) => l,
                None => {
                    return VoiceResult {
                        success: false,
                        message: format!("I couldn't find a todo list called \"{}\".", list_name),
                    }
                }
            };

            let list_id = match &list.id {
                Some(id) => id.to_hex(),
                None => {
                    return VoiceResult {
                        success: false,
                        message: "Unexpected error: list has no ID.".to_string(),
                    }
                }
            };

            // Find today's occurrence for this item (case-insensitive)
            let today = Utc::now().format("%Y-%m-%d").to_string();
            let occ_filter = doc! {
                "listId": &list_id,
                "occurrenceDate": &today,
                "completed": false,
                "$or": [
                    { "itemText": { "$regex": &item_text, "$options": "i" } },
                ]
            };

            let occurrence = match data
                .todo_occurrences_collection
                .find_one(occ_filter, None)
                .await
            {
                Ok(Some(occ)) => occ,
                Ok(None) => {
                    return VoiceResult {
                        success: false,
                        message: format!(
                            "No incomplete todo matching \"{}\" found for today in {}.",
                            item_text, list_name
                        ),
                    }
                }
                Err(e) => {
                    return VoiceResult {
                        success: false,
                        message: format!("Database error: {e}"),
                    }
                }
            };

            let occ_id = match occurrence.id {
                Some(id) => id,
                None => {
                    return VoiceResult {
                        success: false,
                        message: "Occurrence has no ID.".to_string(),
                    }
                }
            };

            // Look up the user's display name (user_id may be an ObjectId hex)
            let completed_by_name: Option<String> =
                if let Ok(uid_oid) = ObjectId::parse_str(&user_id) {
                    data.users_collection
                        .find_one(doc! { "_id": uid_oid }, None)
                        .await
                        .ok()
                        .flatten()
                        .map(|u| u.name)
                } else {
                    None
                };

            let mut set_doc = doc! {
                "completed": true,
                "completedByUserId": &user_id,
                "completedAt": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis()),
            };
            if let Some(name) = &completed_by_name {
                set_doc.insert("completedByName", name.as_str());
            }

            match data
                .todo_occurrences_collection
                .update_one(
                    doc! { "_id": occ_id }, // occ_id is already ObjectId
                    doc! { "$set": set_doc },
                    None,
                )
                .await
            {
                Ok(_) => VoiceResult {
                    success: true,
                    message: format!("Marked \"{item_text}\" as done in {list_name}."),
                },
                Err(e) => VoiceResult {
                    success: false,
                    message: format!("Database error: {e}"),
                },
            }
        }
    }
}

// ── Shared helper: find a list by fuzzy name match ─────────────────────────

async fn find_list_for_user(data: &AppState, user_id: &str, list_name: &str) -> Option<UserList> {
    let filter = doc! {
        "$or": [
            { "ownerId": user_id },
            { "authorizedUsers": user_id }
        ]
    };

    let mut cursor = data.lists_collection.find(filter, None).await.ok()?;
    let name_lower = list_name.to_lowercase();

    let mut best: Option<UserList> = None;
    while let Some(Ok(list)) = cursor.next().await {
        if list.name.to_lowercase().contains(&name_lower) {
            // Prefer exact match over partial
            if list.name.to_lowercase() == name_lower {
                return Some(list);
            }
            best = Some(list);
        }
    }
    best
}

// ══════════════════════════════════════════════════════════════════════════
// Platform 1: Direct REST  (used by Siri Shortcuts)
//
// POST /api/voice/command
// Content-Type: application/json
//
// {
//   "intent":   "add_item",          // add_item | check_off_item | create_list | complete_todo
//   "userId":   "your-user-id",
//   "listName": "Groceries",
//   "itemText": "milk",              // omit for create_list
//   "listType": "shopping"           // only for create_list
// }
// ══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct DirectCommandRequest {
    pub intent: String,
    /// The user's personal voice token (shown in app Settings → Voice Assistants).
    /// If omitted, falls back to userId for backwards compatibility.
    #[serde(default)]
    pub token: String,
    /// Deprecated: use token instead.  Still accepted for direct API callers.
    #[serde(rename = "userId", default)]
    pub user_id: String,
    #[serde(rename = "listName", default)]
    pub list_name: String,
    #[serde(rename = "itemText", default)]
    pub item_text: String,
    #[serde(rename = "listType", default = "default_list_type")]
    pub list_type: String,
}

fn default_list_type() -> String {
    "other".to_string()
}

#[derive(Serialize)]
struct DirectCommandResponse {
    success: bool,
    message: String,
}

pub async fn direct_command(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
    body: web::Json<DirectCommandRequest>,
) -> impl Responder {
    let req = body.into_inner();

    // Resolve userId: prefer token (from query param or body), fall back to raw userId
    let token_from_query = query.get("token").cloned().unwrap_or_default();
    let token = if !token_from_query.is_empty() {
        token_from_query
    } else {
        req.token.clone()
    };

    let user_id = if !token.is_empty() {
        match resolve_user_id_from_token(&data, &token).await {
            Some(id) => id,
            None => return HttpResponse::Unauthorized().json(DirectCommandResponse {
                success: false,
                message: "Invalid voice token. Check your token in the app under Settings → Voice Assistants.".to_string(),
            }),
        }
    } else if !req.user_id.is_empty() {
        req.user_id.clone()
    } else {
        return HttpResponse::Unauthorized().json(DirectCommandResponse {
            success: false,
            message: "Provide your voice token: POST with \"token\" field or ?token= query param."
                .to_string(),
        });
    };

    let cmd = match req.intent.as_str() {
        "add_item" => VoiceCommand::AddItem {
            user_id: user_id.clone(),
            list_name: req.list_name,
            item_text: req.item_text,
        },
        "check_off_item" => VoiceCommand::CheckOffItem {
            user_id: user_id.clone(),
            list_name: req.list_name,
            item_text: req.item_text,
        },
        "create_list" => VoiceCommand::CreateList {
            user_id: user_id.clone(),
            list_name: req.list_name,
            list_type: req.list_type,
        },
        "complete_todo" => VoiceCommand::CompleteTodo {
            user_id: user_id.clone(),
            list_name: req.list_name,
            item_text: req.item_text,
        },
        other => {
            return HttpResponse::BadRequest().json(DirectCommandResponse {
                success: false,
                message: format!("Unknown intent: \"{other}\". Valid intents: add_item, check_off_item, create_list, complete_todo."),
            });
        }
    };

    let result = execute_command(&data, cmd).await;
    let status = if result.success { 200 } else { 422 };
    HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap()).json(
        DirectCommandResponse {
            success: result.success,
            message: result.message,
        },
    )
}

// ══════════════════════════════════════════════════════════════════════════
// Platform 2: Amazon Alexa
//
// POST /api/voice/alexa
//
// Alexa sends a JSON envelope.  We only handle IntentRequest here.
// LaunchRequest responds with a help prompt.
//
// Required Alexa intent slots (configure in the Alexa Developer Console):
//
//   AddItemIntent         → listName (AMAZON.SearchQuery), itemText (AMAZON.SearchQuery)
//   CheckOffItemIntent    → listName, itemText
//   CreateListIntent      → listName, listType (AMAZON.SearchQuery, optional)
//   CompleteTodoIntent    → listName, itemText
//
// Authentication:
//   Enable Account Linking in the Alexa Developer Console.
//   After linking, Alexa passes the user's ID in:
//     request.context.System.user.accessToken
// ══════════════════════════════════════════════════════════════════════════

pub async fn alexa_webhook(data: web::Data<AppState>, body: web::Json<Value>) -> impl Responder {
    let body = body.into_inner();

    let request_type = body
        .pointer("/request/type")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // LaunchRequest — user opened the skill without a specific command
    if request_type == "LaunchRequest" {
        return HttpResponse::Ok().json(alexa_response(
            "Welcome to Budget App! You can say: add milk to Groceries, \
             check off milk in Groceries, create a shopping list called Groceries, \
             or mark buy coffee as done in Morning Routine.",
            false,
        ));
    }

    if request_type != "IntentRequest" {
        return HttpResponse::Ok().json(alexa_response("I didn't understand that request.", true));
    }

    // Extract userId from Account Linking token (set up in Alexa Developer Console)
    let user_id =
        match body
            .pointer("/context/System/user/accessToken")
            .and_then(|v| v.as_str())
        {
            Some(token) if !token.is_empty() => {
                match resolve_user_id_from_token(&data, token).await {
                Some(id) => id,
                None => return HttpResponse::Ok().json(alexa_response(
                    "Your voice token is invalid. Please regenerate it in the Budget App under Settings → Voice Assistants.",
                    true,
                )),
            }
            }
            _ => {
                return HttpResponse::Ok().json(alexa_response(
                "To get started, open Budget App, go to Settings, tap Voice Assistants, and follow the Alexa setup steps.",
                true,
            ));
            }
        };

    let intent_name = body
        .pointer("/request/intent/name")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let slot = |name: &str| -> String {
        body.pointer(&format!("/request/intent/slots/{name}/value"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };

    let cmd = match intent_name {
        "AddItemIntent" => VoiceCommand::AddItem {
            user_id,
            list_name: slot("listName"),
            item_text: slot("itemText"),
        },
        "CheckOffItemIntent" => VoiceCommand::CheckOffItem {
            user_id,
            list_name: slot("listName"),
            item_text: slot("itemText"),
        },
        "CreateListIntent" => VoiceCommand::CreateList {
            user_id,
            list_name: slot("listName"),
            list_type: slot("listType"),
        },
        "CompleteTodoIntent" => VoiceCommand::CompleteTodo {
            user_id,
            list_name: slot("listName"),
            item_text: slot("itemText"),
        },
        "AMAZON.HelpIntent" => {
            return HttpResponse::Ok().json(alexa_response(
                "You can say: add milk to Groceries, check off eggs in Groceries, \
                 create a todo list called Work Tasks, or mark pay bills as done in Bills.",
                false,
            ));
        }
        "AMAZON.StopIntent" | "AMAZON.CancelIntent" => {
            return HttpResponse::Ok().json(alexa_response("Goodbye!", true));
        }
        other => {
            return HttpResponse::Ok().json(alexa_response(
                &format!("I don't know how to handle {other} yet."),
                true,
            ));
        }
    };

    let result = execute_command(&data, cmd).await;
    HttpResponse::Ok().json(alexa_response(&result.message, !result.success))
}

/// Builds the minimal Alexa response envelope.
fn alexa_response(text: &str, end_session: bool) -> Value {
    serde_json::json!({
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": text
            },
            "shouldEndSession": end_session
        }
    })
}

// ══════════════════════════════════════════════════════════════════════════
// Platform 3: Google Actions / Dialogflow CX
//
// POST /api/voice/google
//
// Google sends a Dialogflow webhook JSON.  We read the detected intent name
// and parameters that Dialogflow extracted via NLU.
//
// Required Dialogflow intents (create in Dialogflow Console):
//   add_item        → @sys.any  listName, @sys.any  itemText
//   check_off_item  → @sys.any  listName, @sys.any  itemText
//   create_list     → @sys.any  listName, @sys.any  listType  (optional)
//   complete_todo   → @sys.any  listName, @sys.any  itemText
//
// Authentication:
//   Use Dialogflow's Account Linking with Google Sign-In.
//   After linking, the user's ID is in:
//     originalDetectIntentRequest.payload.user.accessToken
// ══════════════════════════════════════════════════════════════════════════

pub async fn google_webhook(data: web::Data<AppState>, body: web::Json<Value>) -> impl Responder {
    let body = body.into_inner();

    // userId from Account Linking token
    let user_id =
        match body
            .pointer("/originalDetectIntentRequest/payload/user/accessToken")
            .and_then(|v| v.as_str())
        {
            Some(token) if !token.is_empty() => {
                match resolve_user_id_from_token(&data, token).await {
                Some(id) => id,
                None => return HttpResponse::Ok().json(google_response(
                    "Your voice token is invalid. Please regenerate it in the Budget App under Settings → Voice Assistants.",
                )),
            }
            }
            _ => {
                return HttpResponse::Ok().json(google_response(
                "To get started, open Budget App, go to Settings, tap Voice Assistants, and follow the Google setup steps.",
            ));
            }
        };

    let intent_name = body
        .pointer("/queryResult/intent/displayName")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let param = |name: &str| -> String {
        body.pointer(&format!("/queryResult/parameters/{name}"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };

    let cmd = match intent_name {
        "add_item" => VoiceCommand::AddItem {
            user_id,
            list_name: param("listName"),
            item_text: param("itemText"),
        },
        "check_off_item" => VoiceCommand::CheckOffItem {
            user_id,
            list_name: param("listName"),
            item_text: param("itemText"),
        },
        "create_list" => VoiceCommand::CreateList {
            user_id,
            list_name: param("listName"),
            list_type: param("listType"),
        },
        "complete_todo" => VoiceCommand::CompleteTodo {
            user_id,
            list_name: param("listName"),
            item_text: param("itemText"),
        },
        other => {
            return HttpResponse::Ok().json(google_response(&format!(
                "I don't know how to handle \"{other}\" yet."
            )));
        }
    };

    let result = execute_command(&data, cmd).await;
    HttpResponse::Ok().json(google_response(&result.message))
}

/// Builds the minimal Dialogflow fulfillment response envelope.
fn google_response(text: &str) -> Value {
    serde_json::json!({
        "fulfillmentText": text,
        "fulfillmentMessages": [
            {
                "text": { "text": [text] }
            }
        ]
    })
}

// ══════════════════════════════════════════════════════════════════════════
// Token management
//
// GET /api/voice/token?user_id=<userId>
//
// Returns the user's personal voice token, generating one if they don't
// have one yet.  This is the ONLY endpoint the app UI needs to call.
// The token is a stable random hex string — safe to share with voice
// platforms without exposing the internal MongoDB user ID.
// ══════════════════════════════════════════════════════════════════════════

#[derive(Serialize)]
pub struct VoiceTokenResponse {
    pub token: String,
}

pub async fn get_or_create_token(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let user_id_str = match query.get("user_id") {
        Some(id) => id.clone(),
        None => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "message": "user_id required" }))
        }
    };

    let user_oid = match ObjectId::parse_str(&user_id_str) {
        Ok(oid) => oid,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "message": "invalid user_id" }))
        }
    };

    // Fetch current user
    let user = match data
        .users_collection
        .find_one(doc! { "_id": user_oid }, None)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "user not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    // Return existing token or generate a fresh one
    let token = if let Some(t) = user.voice_token {
        t
    } else {
        let new_token = ObjectId::new().to_hex(); // 24-char hex, random
        let _ = data
            .users_collection
            .update_one(
                doc! { "_id": user_oid },
                doc! { "$set": { "voiceToken": &new_token } },
                None,
            )
            .await;
        new_token
    };

    HttpResponse::Ok().json(VoiceTokenResponse { token })
}

// ══════════════════════════════════════════════════════════════════════════
// OAuth 2.0 Account Linking
//
// These three endpoints implement the Authorization Code flow that lets
// Amazon Alexa and Google Actions use "Account Linking."
// The developer registers the app ONCE; end users just tap "Enable" in
// their Alexa / Google Home app and sign in with their Budget App account.
//
// Flow:
//  1. Google/Alexa  → GET  /api/voice/oauth/authorize?client_id=…&redirect_uri=…&state=…
//  2. Server        → 302  to Angular /voice-link?…  (user sees a sign-in page)
//  3. User logs in  → Angular POST /api/voice/oauth/code  { user_id, redirect_uri, state }
//  4. Server        → { redirect_url: "redirect_uri?code=xxx&state=yyy" }
//  5. Angular       → window.location.href = redirect_url
//  6. Google/Alexa  → POST /api/voice/oauth/token  { grant_type, code, … }
//  7. Server        → { access_token, token_type: "Bearer", expires_in }
//  8. From then on  → Alexa/Google sends access_token with every voice request
// ══════════════════════════════════════════════════════════════════════════

/// Short-lived authorization code (valid 5 minutes).
#[derive(Clone)]
pub struct VoiceAuthEntry {
    pub user_id: String,
    pub expires_at: i64, // unix milliseconds
}

/// Shared in-memory store registered as `web::Data` in main.rs.
pub type VoiceOAuthCodes = Arc<Mutex<HashMap<String, VoiceAuthEntry>>>;

// ── Step 1: Redirect user to the Angular sign-in page ────────────────────

/// GET /api/voice/oauth/authorize
///
/// Google/Alexa sends the user here. Forward all OAuth params to the
/// Angular `/voice-link` page so the user can sign in.
pub async fn voice_oauth_authorize(req: HttpRequest) -> impl Responder {
    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "https://budget-list-app.vercel.app".to_string());
    let qs = req.query_string();
    let location = if qs.is_empty() {
        format!("{}/voice-link", frontend_url)
    } else {
        format!("{}/voice-link?{}", frontend_url, qs)
    };
    HttpResponse::Found()
        .insert_header(("Location", location))
        .finish()
}

// ── Step 3: Angular calls this after the user logs in ────────────────────

/// POST /api/voice/oauth/code
///
/// Called by the Angular VoiceLinkComponent once the user is authenticated.
/// Generates a short-lived code and returns the redirect URL so Angular
/// can send the user back to Google/Alexa.
#[derive(Deserialize)]
pub struct GenerateCodeRequest {
    pub user_id: String,
    pub redirect_uri: String,
    pub state: String,
    #[serde(default)]
    pub client_id: String,
}

pub async fn voice_oauth_generate_code(
    data: web::Data<AppState>,
    oauth_codes: web::Data<VoiceOAuthCodes>,
    body: web::Json<GenerateCodeRequest>,
) -> impl Responder {
    let req = body.into_inner();

    let user_oid = match ObjectId::parse_str(&req.user_id) {
        Ok(o) => o,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "error": "invalid user_id" }))
        }
    };

    let user = match data
        .users_collection
        .find_one(doc! { "_id": user_oid }, None)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({ "error": "user not found" }))
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": e.to_string() }))
        }
    };

    // Ensure this user has a voice token (creates one if absent)
    if user.voice_token.is_none() {
        let new_token = ObjectId::new().to_hex();
        let _ = data
            .users_collection
            .update_one(
                doc! { "_id": user_oid },
                doc! { "$set": { "voiceToken": &new_token } },
                None,
            )
            .await;
    }

    // 48-char auth code, valid for 5 minutes
    let code = format!("{}{}", ObjectId::new().to_hex(), ObjectId::new().to_hex());
    let expires_at = Utc::now().timestamp_millis() + 5 * 60 * 1000;

    oauth_codes.lock().unwrap().insert(
        code.clone(),
        VoiceAuthEntry {
            user_id: req.user_id,
            expires_at,
        },
    );

    let redirect_url = format!("{}?code={}&state={}", req.redirect_uri, code, req.state);
    HttpResponse::Ok().json(serde_json::json!({ "redirect_url": redirect_url }))
}

// ── Step 6: Google/Alexa exchanges the code for an access token ──────────

/// POST /api/voice/oauth/token
///
/// Standard OAuth 2.0 token endpoint (application/x-www-form-urlencoded).
/// Returns the user's voice token as the Bearer access_token.
#[derive(Deserialize)]
pub struct OAuthTokenRequest {
    pub grant_type: String,
    pub code: String,
    #[serde(default)]
    pub client_id: String,
    #[serde(default)]
    pub client_secret: String,
    #[serde(default)]
    pub redirect_uri: String,
}

pub async fn voice_oauth_token(
    data: web::Data<AppState>,
    oauth_codes: web::Data<VoiceOAuthCodes>,
    form: web::Form<OAuthTokenRequest>,
) -> impl Responder {
    if form.grant_type != "authorization_code" {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({ "error": "unsupported_grant_type" }));
    }

    // Consume the code (one-time use)
    let entry = oauth_codes.lock().unwrap().remove(&form.code);
    let entry = match entry {
        Some(e) => e,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "invalid_grant",
                "error_description": "Authorization code not found or already used."
            }))
        }
    };

    if Utc::now().timestamp_millis() > entry.expires_at {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_grant",
            "error_description": "Authorization code has expired."
        }));
    }

    let user_oid = match ObjectId::parse_str(&entry.user_id) {
        Ok(o) => o,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "server_error" }))
        }
    };

    let user = match data
        .users_collection
        .find_one(doc! { "_id": user_oid }, None)
        .await
    {
        Ok(Some(u)) => u,
        _ => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "server_error" }))
        }
    };

    let access_token = match user.voice_token {
        Some(t) => t,
        None => {
            // Shouldn't happen (we ensure it in generate_code), but handle gracefully
            let t = ObjectId::new().to_hex();
            let _ = data
                .users_collection
                .update_one(
                    doc! { "_id": user_oid },
                    doc! { "$set": { "voiceToken": &t } },
                    None,
                )
                .await;
            t
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 315360000  // 10 years — token doesn't expire unless user regenerates it
    }))
}
