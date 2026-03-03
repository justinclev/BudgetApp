use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};

use crate::db::AppState;
use crate::models::{
    AddItemRequest, CloneListRequest, CompleteOccurrenceRequest, CreateListRequest,
    JoinListRequest, ListItem, ReorderItemsRequest, SubItem, ToggleItemRequest, UpdateItemRequest,
    UpdateListRequest, UserList,
};

// ── Helpers ────────────────────────────────────────────────────────────────

fn new_id() -> String {
    ObjectId::new().to_hex()
}

fn new_share_token() -> String {
    ObjectId::new().to_hex()
}

// ── GET /api/lists?user_id=xxx ─────────────────────────────────────────────

pub async fn get_lists(
    data: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let user_id = match query.get("user_id") {
        Some(uid) => uid.clone(),
        None => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "message": "user_id query param required" }))
        }
    };

    let filter = doc! {
        "$or": [
            { "ownerId": &user_id },
            { "authorizedUsers": &user_id }
        ]
    };

    let mut cursor = match data.lists_collection.find(filter, None).await {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let mut lists: Vec<UserList> = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(list) => lists.push(list),
            Err(e) => eprintln!("Error deserializing list: {:?}", e),
        }
    }

    lists.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    HttpResponse::Ok().json(lists)
}

// ── POST /api/lists ────────────────────────────────────────────────────────

pub async fn create_list(
    data: web::Data<AppState>,
    body: web::Json<CreateListRequest>,
) -> impl Responder {
    let req = body.into_inner();
    let complete_by_date = req
        .complete_by_date
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));
    let new_list = UserList {
        id: None,
        name: req.name,
        list_type: req.list_type,
        owner_id: req.owner_id.clone(),
        created_by_user_id: req.owner_id.clone(),
        authorized_users: vec![req.owner_id],
        items: vec![],
        share_token: new_share_token(),
        created_at: Utc::now(),
        complete_by_date,
        repeat_frequency: req.repeat_frequency,
    };

    match data.lists_collection.insert_one(new_list, None).await {
        Ok(result) => {
            if let Some(new_id) = result.inserted_id.as_object_id() {
                match data
                    .lists_collection
                    .find_one(doc! { "_id": new_id }, None)
                    .await
                {
                    Ok(Some(list)) => HttpResponse::Created().json(list),
                    _ => {
                        HttpResponse::InternalServerError().body("Failed to retrieve created list")
                    }
                }
            } else {
                HttpResponse::InternalServerError().body("Failed to get inserted ID")
            }
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── GET /api/lists/:id ─────────────────────────────────────────────────────

pub async fn get_list(data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    match data
        .lists_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(list)) => HttpResponse::Ok().json(list),
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── PUT /api/lists/:id ─────────────────────────────────────────────────────

pub async fn update_list(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateListRequest>,
) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    let req = body.into_inner();
    let mut set_doc = doc! { "name": &req.name, "listType": &req.list_type };
    if let Some(cbd) = &req.complete_by_date {
        if cbd.is_empty() {
            set_doc.insert("completeByDate", mongodb::bson::Bson::Null);
        } else if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(cbd) {
            set_doc.insert(
                "completeByDate",
                mongodb::bson::DateTime::from_millis(dt.timestamp_millis()),
            );
        }
    }
    match &req.repeat_frequency {
        Some(rf) if rf.is_empty() => {
            set_doc.insert("repeatFrequency", mongodb::bson::Bson::Null);
        }
        Some(rf) => {
            set_doc.insert("repeatFrequency", rf.as_str());
        }
        None => {}
    }
    let update = doc! { "$set": set_doc };

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "List not found after update" })),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── DELETE /api/lists/:id ──────────────────────────────────────────────────

pub async fn delete_list(data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    match data
        .lists_collection
        .delete_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(result) if result.deleted_count == 1 => {
            HttpResponse::Ok().json(serde_json::json!({ "message": "List deleted" }))
        }
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" })),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/lists/:id/items ──────────────────────────────────────────────

pub async fn add_item(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<AddItemRequest>,
) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    let req = body.into_inner();
    let new_item = ListItem {
        id: new_id(),
        text: req.text,
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

    let update = doc! { "$push": { "items": item_doc } };

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── DELETE /api/lists/:list_id/items/:item_id ──────────────────────────────

pub async fn delete_item(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (list_id_str, item_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    let update = doc! { "$pull": { "items": { "id": &item_id } } };

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── DELETE /api/lists/:id/members/:user_id ─────────────────────────

pub async fn remove_member(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (list_id_str, user_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let update = doc! { "$pull": { "authorizedUsers": &user_id } };
    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/lists/:id/items/reorder ───────────────────────────────

pub async fn reorder_items(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<ReorderItemsRequest>,
) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let req = body.into_inner();

    let list = match data
        .lists_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(l)) => l,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let mut item_map: std::collections::HashMap<String, ListItem> = list
        .items
        .into_iter()
        .map(|item| (item.id.clone(), item))
        .collect();

    let mut reordered: Vec<ListItem> = req
        .item_ids
        .iter()
        .filter_map(|id| item_map.remove(id))
        .collect();
    reordered.extend(item_map.into_values());

    let items_bson = match mongodb::bson::to_bson(&reordered) {
        Ok(b) => b,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let update = doc! { "$set": { "items": items_bson } };
    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── PATCH /api/lists/:list_id/items/:item_id ──────────────────────────────────

pub async fn update_item_text(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
    body: web::Json<UpdateItemRequest>,
) -> impl Responder {
    let (list_id_str, item_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let req = body.into_inner();
    let update = doc! { "$set": { "items.$[elem].text": &req.text } };
    let array_filters = vec![doc! { "elem.id": { "$eq": &item_id } }];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();
    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── PATCH /api/lists/:list_id/items/:item_id/toggle ────────────────────────

pub async fn toggle_item(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
    body: web::Json<ToggleItemRequest>,
) -> impl Responder {
    let (list_id_str, item_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    // Fetch current state
    let list = match data
        .lists_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(l)) => l,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let current_completed = list
        .items
        .iter()
        .find(|i| i.id == item_id)
        .map(|i| i.completed)
        .unwrap_or(false);

    let new_completed = !current_completed;

    let mut set_fields = doc! { "items.$[elem].completed": new_completed };
    if new_completed {
        // Record who completed it
        if let Some(uid) = &body.user_id {
            set_fields.insert("items.$[elem].completedByUserId", uid.as_str());
        }
    } else {
        // Clear the completed-by when un-completing
        set_fields.insert("items.$[elem].completedByUserId", mongodb::bson::Bson::Null);
    }

    let update = doc! { "$set": set_fields };
    let array_filters = vec![doc! { "elem.id": { "$eq": &item_id } }];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── PATCH /api/lists/:id/items/:item_id/complete-occurrence ───────────────
// Toggles completion of a single recurrence occurrence identified by `date`
// (YYYY-MM-DD). If lastCompletedAt already equals `date`, clears it (un-complete).
// Does NOT touch item.completed so the recurring item reappears on future dates.

pub async fn complete_occurrence(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
    body: web::Json<CompleteOccurrenceRequest>,
) -> impl Responder {
    let (list_id_str, item_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let req = body.into_inner();

    // Fetch current state to check whether we're toggling on or off
    let list = match data
        .lists_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(l)) => l,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let already_done = list
        .items
        .iter()
        .find(|i| i.id == item_id)
        .and_then(|i| i.last_completed_at.as_deref())
        .map(|d| d == req.date)
        .unwrap_or(false);

    let (new_date, new_user): (mongodb::bson::Bson, mongodb::bson::Bson) = if already_done {
        (mongodb::bson::Bson::Null, mongodb::bson::Bson::Null)
    } else {
        let user_val = req
            .user_id
            .as_deref()
            .map(|u| mongodb::bson::Bson::String(u.to_string()))
            .unwrap_or(mongodb::bson::Bson::Null);
        (mongodb::bson::Bson::String(req.date), user_val)
    };

    let update = doc! {
        "$set": {
            "items.$[elem].lastCompletedAt": new_date,
            "items.$[elem].lastCompletedByUserId": new_user,
        }
    };
    let array_filters = vec![doc! { "elem.id": { "$eq": &item_id } }];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/lists/:id/reset ──────────────────────────────────────────────

pub async fn reset_list(data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    // Use an aggregation pipeline update so $ifNull handles old documents
    // that predate the subItems field — a plain $set with positional operators
    // fails with "path must exist" on those legacy items.
    let pipeline = vec![doc! {
        "$set": {
            "items": {
                "$map": {
                    "input": "$items",
                    "as": "item",
                    "in": {
                        "$mergeObjects": [
                            "$$item",
                            {
                                "completed": false,
                                "completedByUserId": "$$REMOVE",
                                "lastCompletedAt": "$$REMOVE",
                                "lastCompletedByUserId": "$$REMOVE",
                                "subItems": {
                                    "$map": {
                                        "input": { "$ifNull": ["$$item.subItems", []] },
                                        "as": "sub",
                                        "in": { "$mergeObjects": ["$$sub", { "completed": false }] }
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        }
    }];

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, pipeline, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/lists/:id/clone ──────────────────────────────────────────────

pub async fn clone_list(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CloneListRequest>,
) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    let source = match data
        .lists_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(l)) => l,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let req = body.into_inner();
    let new_name = req
        .name
        .unwrap_or_else(|| format!("{} (copy)", source.name));

    let cloned_items: Vec<ListItem> = source
        .items
        .into_iter()
        .map(|item| ListItem {
            id: new_id(),
            text: item.text,
            completed: false,
            completed_by_user_id: None,
            last_completed_at: None,
            last_completed_by_user_id: None,
            created_at: Utc::now(),
            sub_items: item
                .sub_items
                .into_iter()
                .map(|sub| SubItem {
                    id: new_id(),
                    text: sub.text,
                    completed: false,
                    created_at: Utc::now(),
                })
                .collect(),
        })
        .collect();

    let new_list = UserList {
        id: None,
        name: new_name,
        list_type: source.list_type,
        owner_id: req.owner_id.clone(),
        created_by_user_id: req.owner_id.clone(),
        authorized_users: vec![req.owner_id],
        items: cloned_items,
        share_token: new_share_token(),
        created_at: Utc::now(),
        complete_by_date: source.complete_by_date,
        repeat_frequency: source.repeat_frequency,
    };

    match data.lists_collection.insert_one(new_list, None).await {
        Ok(result) => {
            if let Some(new_id) = result.inserted_id.as_object_id() {
                match data
                    .lists_collection
                    .find_one(doc! { "_id": new_id }, None)
                    .await
                {
                    Ok(Some(list)) => HttpResponse::Created().json(list),
                    _ => HttpResponse::InternalServerError().body("Failed to retrieve cloned list"),
                }
            } else {
                HttpResponse::InternalServerError().body("Failed to get inserted ID")
            }
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── GET /api/lists/share/:token ────────────────────────────────────────────

pub async fn get_list_by_share_token(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let token = path.into_inner();

    match data
        .lists_collection
        .find_one(doc! { "shareToken": &token }, None)
        .await
    {
        Ok(Some(list)) => HttpResponse::Ok().json(list),
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/lists/share/:token/join ─────────────────────────────────────

pub async fn join_list_by_share_token(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<JoinListRequest>,
) -> impl Responder {
    let token = path.into_inner();
    let user_id = body.into_inner().user_id;

    // Only add if not already in authorizedUsers
    let update = doc! { "$addToSet": { "authorizedUsers": &user_id } };

    match data
        .lists_collection
        .find_one_and_update(doc! { "shareToken": &token }, update, None)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "shareToken": &token }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => HttpResponse::NotFound()
            .json(serde_json::json!({ "message": "List not found or invalid share token" })),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/lists/:list_id/items/:item_id/subitems ──────────────────────────────
pub async fn add_sub_item(
    data: web::Data<AppState>,
    path: web::Path<(String, String)>,
    body: web::Json<AddItemRequest>,
) -> impl Responder {
    let (list_id_str, item_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    let new_sub = SubItem {
        id: new_id(),
        text: body.into_inner().text,
        completed: false,
        created_at: Utc::now(),
    };
    let sub_doc = match mongodb::bson::to_document(&new_sub) {
        Ok(d) => d,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
    let update = doc! { "$push": { "items.$[item].subItems": sub_doc } };
    let array_filters = vec![doc! { "item.id": { "$eq": &item_id } }];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();

    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── PATCH /api/lists/:list_id/items/:item_id/subitems/:sub_id ───────────────────
pub async fn update_sub_item_text(
    data: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
    body: web::Json<UpdateItemRequest>,
) -> impl Responder {
    let (list_id_str, item_id, sub_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let req = body.into_inner();
    let update = doc! { "$set": { "items.$[item].subItems.$[sub].text": &req.text } };
    let array_filters = vec![
        doc! { "item.id": { "$eq": &item_id } },
        doc! { "sub.id": { "$eq": &sub_id } },
    ];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();
    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── DELETE /api/lists/:list_id/items/:item_id/subitems/:sub_id ──────────────────
pub async fn delete_sub_item(
    data: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
) -> impl Responder {
    let (list_id_str, item_id, sub_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let update = doc! { "$pull": { "items.$[item].subItems": { "id": &sub_id } } };
    let array_filters = vec![doc! { "item.id": { "$eq": &item_id } }];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();
    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── PATCH /api/lists/:list_id/items/:item_id/subitems/:sub_id/toggle ───────────
pub async fn toggle_sub_item(
    data: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
) -> impl Responder {
    let (list_id_str, item_id, sub_id) = path.into_inner();
    let object_id = match ObjectId::parse_str(&list_id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };
    let list = match data
        .lists_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(l)) => l,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
    let current = list
        .items
        .iter()
        .find(|i| i.id == item_id)
        .and_then(|i| i.sub_items.iter().find(|s| s.id == sub_id))
        .map(|s| s.completed)
        .unwrap_or(false);
    let update = doc! { "$set": { "items.$[item].subItems.$[sub].completed": !current } };
    let array_filters = vec![
        doc! { "item.id": { "$eq": &item_id } },
        doc! { "sub.id": { "$eq": &sub_id } },
    ];
    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .array_filters(array_filters)
        .build();
    match data
        .lists_collection
        .find_one_and_update(doc! { "_id": object_id }, update, options)
        .await
    {
        Ok(Some(_)) => match data
            .lists_collection
            .find_one(doc! { "_id": object_id }, None)
            .await
        {
            Ok(Some(list)) => HttpResponse::Ok().json(list),
            _ => HttpResponse::InternalServerError().body("Failed to retrieve updated list"),
        },
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "List not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}
