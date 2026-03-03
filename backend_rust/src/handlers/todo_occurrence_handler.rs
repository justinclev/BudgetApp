use actix_web::{web, HttpResponse, Responder};
use chrono::{Datelike, Duration, NaiveDate, Utc};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use std::collections::HashSet;

use crate::db::AppState;
use crate::models::{GenerateOccurrencesRequest, ToggleOccurrenceRequest};

// ── Date helpers ───────────────────────────────────────────────────────────

fn days_in_month(year: i32, month: u32) -> u32 {
    if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .unwrap()
    .pred_opt()
    .unwrap()
    .day()
}

/// Mirrors the TypeScript `isScheduledOn` in todo-recurrence.ts.
fn is_scheduled_on(start: NaiveDate, freq: &str, check: NaiveDate) -> bool {
    if check < start {
        return false;
    }
    let diff = (check - start).num_days();
    match freq {
        "daily" => true,
        "every-other-day" => diff % 2 == 0,
        "weekly" => diff % 7 == 0,
        "biweekly" => diff % 14 == 0,
        "semimonthly" => {
            let start_day = start.day();
            let check_day = check.day();
            let dim = days_in_month(check.year(), check.month());
            let second_day = (start_day + 15).min(dim);
            check_day == start_day || check_day == second_day
        }
        "monthly" => check.day() == start.day(),
        "yearly" => check.month() == start.month() && check.day() == start.day(),
        _ => false,
    }
}

// ── POST /api/todo-occurrences/generate ───────────────────────────────────

pub async fn generate_occurrences(
    data: web::Data<AppState>,
    body: web::Json<GenerateOccurrencesRequest>,
) -> impl Responder {
    let req = body.into_inner();

    let range_start = match NaiveDate::parse_from_str(&req.start_date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "message": "invalid startDate" }))
        }
    };
    let range_end = match NaiveDate::parse_from_str(&req.end_date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "message": "invalid endDate" }))
        }
    };
    let range_start_str = range_start.format("%Y-%m-%d").to_string();
    let range_end_str = range_end.format("%Y-%m-%d").to_string();

    // ── Step 1: Fetch all todo lists the user has access to ───────────────
    let list_filter = doc! {
        "$or": [
            { "ownerId": &req.user_id },
            { "authorizedUsers": &req.user_id }
        ],
        "listType": "todo"
    };
    let mut cursor = match data.lists_collection.find(list_filter, None).await {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
    let mut lists = vec![];
    while let Some(result) = cursor.next().await {
        if let Ok(list) = result {
            lists.push(list);
        }
    }

    // ── Step 2: Fetch all existing occurrence keys for the range (1 query) ─
    let exist_filter = doc! {
        "ownerId": &req.user_id,
        "occurrenceDate": { "$gte": &range_start_str, "$lte": &range_end_str }
    };
    let proj = mongodb::options::FindOptions::builder()
        .projection(doc! { "listId": 1, "itemId": 1, "occurrenceDate": 1, "_id": 0 })
        .build();
    // Use raw Document to avoid full deserialization
    let mut exist_cursor = match data
        .todo_occurrences_collection
        .clone_with_type::<mongodb::bson::Document>()
        .find(exist_filter, proj)
        .await
    {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
    let mut existing: HashSet<(String, String, String)> = HashSet::new();
    while let Some(Ok(doc)) = exist_cursor.next().await {
        if let (Some(lid), Some(iid), Some(od)) = (
            doc.get_str("listId").ok(),
            doc.get_str("itemId").ok(),
            doc.get_str("occurrenceDate").ok(),
        ) {
            existing.insert((lid.to_string(), iid.to_string(), od.to_string()));
        }
    }

    // ── Step 3: Build only the missing occurrence docs ────────────────────
    let now_ms = Utc::now().timestamp_millis();
    let mut new_docs: Vec<mongodb::bson::Document> = vec![];

    for list in &lists {
        let list_id = match &list.id {
            Some(id) => id.to_hex(),
            None => continue,
        };
        let items: Vec<_> = list.items.iter().filter(|i| !i.completed).collect();
        if items.is_empty() {
            continue;
        }
        let list_start_naive: Option<NaiveDate> = list.complete_by_date.map(|dt| dt.date_naive());
        let list_due_date_str: Option<String> =
            list_start_naive.map(|d| d.format("%Y-%m-%d").to_string());

        let mut current = range_start;
        while current <= range_end {
            let occurrence_date = current.format("%Y-%m-%d").to_string();
            let is_scheduled = match (&list.repeat_frequency, list_start_naive) {
                (Some(freq), Some(start)) => is_scheduled_on(start, freq, current),
                (None, Some(due)) => due == current,
                (None, None) => true,
                (Some(_), None) => false,
            };
            if is_scheduled {
                for item in &items {
                    let key = (list_id.clone(), item.id.clone(), occurrence_date.clone());
                    if existing.contains(&key) {
                        continue; // already in DB — skip
                    }
                    let mut doc = doc! {
                        "listId": &list_id,
                        "itemId": &item.id,
                        "itemText": &item.text,
                        "listName": &list.name,
                        "occurrenceDate": &occurrence_date,
                        "ownerId": &list.owner_id,
                        "completed": false,
                        "createdAt": mongodb::bson::DateTime::from_millis(now_ms),
                    };
                    if let Some(freq) = &list.repeat_frequency {
                        doc.insert("repeatFrequency", freq.as_str());
                    }
                    if let Some(ldd) = &list_due_date_str {
                        doc.insert("listDueDate", ldd.as_str());
                    }
                    new_docs.push(doc);
                }
            }
            current += Duration::days(1);
        }
    }

    // ── Step 4: Insert all missing docs in one call ───────────────────────
    let generated = new_docs.len();
    if !new_docs.is_empty() {
        let opts = mongodb::options::InsertManyOptions::builder()
            .ordered(false) // continue on duplicate-key errors
            .build();
        if let Err(e) = data
            .todo_occurrences_collection
            .clone_with_type::<mongodb::bson::Document>()
            .insert_many(new_docs, opts)
            .await
        {
            // BulkWriteError with only duplicate-key failures is acceptable
            eprintln!("insert_many (some dupes expected): {:?}", e);
        }
    }

    HttpResponse::Ok().json(serde_json::json!({ "generated": generated }))
}

// ── GET /api/todo-occurrences ─────────────────────────────────────────────

pub async fn get_occurrences(
    data: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let user_id = match query.get("user_id") {
        Some(uid) => uid.clone(),
        None => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({ "message": "user_id required" }))
        }
    };
    let start_date = query.get("start_date").cloned().unwrap_or_default();
    let end_date = query.get("end_date").cloned().unwrap_or_default();

    // Step 1: find list IDs the user has access to
    let list_filter = doc! {
        "$or": [
            { "ownerId": &user_id },
            { "authorizedUsers": &user_id }
        ],
        "listType": "todo"
    };

    let mut list_cursor = match data.lists_collection.find(list_filter, None).await {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let mut list_ids: Vec<String> = vec![];
    while let Some(result) = list_cursor.next().await {
        if let Ok(list) = result {
            if let Some(id) = &list.id {
                list_ids.push(id.to_hex());
            }
        }
    }

    if list_ids.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!([]));
    }

    // Step 2: query occurrences for those lists within the date window
    let bson_ids: Vec<mongodb::bson::Bson> = list_ids
        .iter()
        .map(|id| mongodb::bson::Bson::String(id.clone()))
        .collect();

    let mut occ_filter = doc! { "listId": { "$in": bson_ids } };
    if !start_date.is_empty() && !end_date.is_empty() {
        occ_filter.insert(
            "occurrenceDate",
            doc! { "$gte": &start_date, "$lte": &end_date },
        );
    }

    let find_opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "occurrenceDate": 1 })
        .build();

    let mut cursor = match data
        .todo_occurrences_collection
        .find(occ_filter, find_opts)
        .await
    {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let mut occurrences = vec![];
    while let Some(result) = cursor.next().await {
        match result {
            Ok(o) => occurrences.push(o),
            Err(e) => eprintln!("Error deserializing occurrence: {:?}", e),
        }
    }

    HttpResponse::Ok().json(occurrences)
}

// ── PATCH /api/todo-occurrences/{id}/toggle ───────────────────────────────

pub async fn toggle_occurrence(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<ToggleOccurrenceRequest>,
) -> impl Responder {
    let id_str = path.into_inner();
    let req = body.into_inner();

    let oid = match ObjectId::parse_str(&id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({ "message": "invalid id" }))
        }
    };

    // Fetch current to know the toggle direction
    let current = match data
        .todo_occurrences_collection
        .find_one(doc! { "_id": oid }, None)
        .await
    {
        Ok(Some(o)) => o,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "message": "occurrence not found" }))
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    // Verify the requesting user owns or is authorized on the parent list
    if let Some(uid) = &req.user_id {
        let list_oid = match ObjectId::parse_str(&current.list_id) {
            Ok(id) => id,
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({ "message": "invalid list id on occurrence" }))
            }
        };
        let list_filter = doc! {
            "_id": list_oid,
            "$or": [
                { "ownerId": uid },
                { "authorizedUsers": uid }
            ]
        };
        match data.lists_collection.find_one(list_filter, None).await {
            Ok(Some(_)) => {} // authorized
            Ok(None) => {
                return HttpResponse::Forbidden()
                    .json(serde_json::json!({ "message": "not authorized to update this list" }))
            }
            Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
        }
    }

    let new_completed = !current.completed;

    // Resolve the user's display name for the completed-by attribution
    let completed_by_name: Option<String> = if new_completed {
        if let Some(uid) = &req.user_id {
            if let Ok(Some(oid)) = ObjectId::parse_str(uid).map(Some) {
                match data
                    .users_collection
                    .find_one(doc! { "_id": oid }, None)
                    .await
                {
                    Ok(Some(user)) => Some(user.name),
                    _ => Some(uid.clone()),
                }
            } else {
                Some(uid.clone())
            }
        } else {
            None
        }
    } else {
        None
    };

    let update = if new_completed {
        let user_id_str = req.user_id.as_deref().unwrap_or("").to_string();
        let mut set_doc = doc! {
            "completed": true,
            "completedByUserId": &user_id_str,
            "completedAt": mongodb::bson::DateTime::from_millis(
                Utc::now().timestamp_millis()
            ),
        };
        if let Some(name) = &completed_by_name {
            set_doc.insert("completedByName", name.as_str());
        }
        doc! { "$set": set_doc }
    } else {
        doc! {
            "$set": { "completed": false },
            "$unset": { "completedByUserId": "", "completedAt": "", "completedByName": "" }
        }
    };

    if let Err(e) = data
        .todo_occurrences_collection
        .update_one(doc! { "_id": oid }, update, None)
        .await
    {
        return HttpResponse::InternalServerError().body(e.to_string());
    }

    // Return updated doc
    match data
        .todo_occurrences_collection
        .find_one(doc! { "_id": oid }, None)
        .await
    {
        Ok(Some(o)) => HttpResponse::Ok().json(o),
        Ok(None) => HttpResponse::NotFound()
            .json(serde_json::json!({ "message": "occurrence missing after update" })),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}
