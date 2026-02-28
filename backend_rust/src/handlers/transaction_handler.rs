use actix_web::{web, HttpRequest, HttpResponse, Responder};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use crate::models::{RecurringTransaction, CheckNameResponse};
use crate::db::AppState;

fn extract_user_id(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

pub async fn get_transactions(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };

    let mut cursor = match data.transactions_collection.find(doc! { "user_id": &user_id }, None).await {
        Ok(cursor) => cursor,
        Err(err) => return HttpResponse::InternalServerError().body(err.to_string()),
    };

    let mut transactions: Vec<RecurringTransaction> = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(t) => transactions.push(t),
            Err(e) => {
                 println!("Error deserializing transaction: {:?}", e);
            }
        }
    }
    
    transactions.sort_by(|a, b| a.name.cmp(&b.name));

    HttpResponse::Ok().json(transactions)
}

pub async fn create_transaction(
    req: HttpRequest,
    data: web::Data<AppState>,
    transaction: web::Json<RecurringTransaction>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    let mut new_transaction = transaction.into_inner();
    new_transaction.user_id = user_id;
    match data.transactions_collection.insert_one(new_transaction, None).await {
        Ok(insert_result) => {
             if let Some(new_id) = insert_result.inserted_id.as_object_id() {
                 match data.transactions_collection.find_one(doc! { "_id": new_id }, None).await {
                     Ok(Some(t)) => HttpResponse::Created().json(t),
                     _ => HttpResponse::InternalServerError().body("Failed to retrieve created transaction"),
                 }
            } else {
                HttpResponse::InternalServerError().body("Failed to get inserted ID")
            }
        }
        Err(err) => {
             if err.to_string().contains("11000") {
                 HttpResponse::BadRequest().json(serde_json::json!({ "message": "Transaction with this name already exists" }))
            } else {
                 HttpResponse::InternalServerError().body(err.to_string())
            }
        }
    }
}

pub async fn update_transaction(
    req: HttpRequest,
    data: web::Data<AppState>,
    path: web::Path<String>,
    transaction: web::Json<RecurringTransaction>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    let update_data = transaction.into_inner();
    let mut doc = match mongodb::bson::to_document(&update_data) {
        Ok(doc) => doc,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
    doc.remove("_id");
    doc.remove("user_id");

    match data
        .transactions_collection
        .find_one_and_update(doc! { "_id": object_id, "user_id": &user_id }, doc! { "$set": doc }, None)
        .await
    {
        Ok(Some(_)) => {
             match data.transactions_collection.find_one(doc! { "_id": object_id }, None).await {
                     Ok(Some(t)) => HttpResponse::Ok().json(t),
                     _ => HttpResponse::NotFound().json(serde_json::json!({ "message": "Transaction not found after update" })),
                 }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "message": "Transaction not found" })),
        Err(err) => {
            if err.to_string().contains("11000") {
                 HttpResponse::BadRequest().json(serde_json::json!({ "message": "Transaction with this name already exists" }))
            } else {
                 HttpResponse::InternalServerError().body(err.to_string())
            }
        }
    }
}

pub async fn delete_transaction(req: HttpRequest, data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    match data.transactions_collection.delete_one(doc! { "_id": object_id, "user_id": &user_id }, None).await {
        Ok(result) => {
            if result.deleted_count == 1 {
                HttpResponse::Ok().json(serde_json::json!({ "message": "Transaction deleted successfully" }))
            } else {
                HttpResponse::NotFound().json(serde_json::json!({ "message": "Transaction not found" }))
            }
        }
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}

pub async fn check_transaction_name(
    req: HttpRequest,
    data: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    let name = path.into_inner();
    let exclude_id_str = query.get("excludeId");

    let mut filter = doc! { "name": name, "user_id": &user_id };
    if let Some(id_str) = exclude_id_str {
        if let Ok(oid) = ObjectId::parse_str(id_str) {
            filter.insert("_id", doc! { "$ne": oid });
        }
    }

    match data.transactions_collection.find_one(filter, None).await {
        Ok(Some(_)) => HttpResponse::Ok().json(CheckNameResponse { exists: true }),
        Ok(None) => HttpResponse::Ok().json(CheckNameResponse { exists: false }),
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}
