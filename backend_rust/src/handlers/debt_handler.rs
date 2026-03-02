use crate::db::AppState;
use crate::models::{CheckNameResponse, Debt};
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};

fn extract_user_id(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

pub async fn get_debts(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };

    println!("[get_debts] querying createdByUserId = {:?}", user_id);

    let mut cursor = match data
        .debts_collection
        .find(doc! { "createdByUserId": &user_id }, None)
        .await
    {
        Ok(cursor) => cursor,
        Err(err) => return HttpResponse::InternalServerError().body(err.to_string()),
    };

    let mut debts: Vec<Debt> = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(debt) => debts.push(debt),
            Err(e) => {
                println!("Error deserializing debt: {:?}", e);
            }
        }
    }

    debts.sort_by(|a, b| a.name.cmp(&b.name));

    HttpResponse::Ok().json(debts)
}

pub async fn create_debt(
    req: HttpRequest,
    data: web::Data<AppState>,
    debt: web::Json<Debt>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    let mut new_debt = debt.into_inner();
    new_debt.created_by_user_id = user_id;
    match data.debts_collection.insert_one(new_debt, None).await {
        Ok(insert_result) => {
            if let Some(new_id) = insert_result.inserted_id.as_object_id() {
                match data
                    .debts_collection
                    .find_one(doc! { "_id": new_id }, None)
                    .await
                {
                    Ok(Some(debt)) => HttpResponse::Created().json(debt),
                    _ => {
                        HttpResponse::InternalServerError().body("Failed to retrieve created debt")
                    }
                }
            } else {
                HttpResponse::InternalServerError().body("Failed to get inserted ID")
            }
        }
        Err(err) => {
            if err.to_string().contains("11000") {
                HttpResponse::BadRequest()
                    .json(serde_json::json!({ "message": "Debt with this name already exists" }))
            } else {
                HttpResponse::InternalServerError().body(err.to_string())
            }
        }
    }
}

pub async fn update_debt(
    req: HttpRequest,
    data: web::Data<AppState>,
    path: web::Path<String>,
    debt: web::Json<Debt>,
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

    let update_data = debt.into_inner();
    let mut doc = match mongodb::bson::to_document(&update_data) {
        Ok(doc) => doc,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
    doc.remove("_id");
    doc.remove("user_id");

    match data
        .debts_collection
        .find_one_and_update(
            doc! { "_id": object_id, "user_id": &user_id },
            doc! { "$set": doc },
            None,
        )
        .await
    {
        Ok(Some(_)) => {
            match data
                .debts_collection
                .find_one(doc! { "_id": object_id }, None)
                .await
            {
                Ok(Some(updated_debt)) => HttpResponse::Ok().json(updated_debt),
                _ => HttpResponse::NotFound()
                    .json(serde_json::json!({ "message": "Debt not found after update" })),
            }
        }
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "Debt not found" }))
        }
        Err(err) => {
            if err.to_string().contains("11000") {
                HttpResponse::BadRequest()
                    .json(serde_json::json!({ "message": "Debt with this name already exists" }))
            } else {
                HttpResponse::InternalServerError().body(err.to_string())
            }
        }
    }
}

pub async fn delete_debt(
    req: HttpRequest,
    data: web::Data<AppState>,
    path: web::Path<String>,
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

    match data
        .debts_collection
        .delete_one(doc! { "_id": object_id, "user_id": &user_id }, None)
        .await
    {
        Ok(result) => {
            if result.deleted_count == 1 {
                HttpResponse::Ok()
                    .json(serde_json::json!({ "message": "Debt deleted successfully" }))
            } else {
                HttpResponse::NotFound().json(serde_json::json!({ "message": "Debt not found" }))
            }
        }
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}

pub async fn check_debt_name(
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

    let mut filter = doc! { "name": name, "createdByUserId": &user_id };
    if let Some(id_str) = exclude_id_str {
        if let Ok(oid) = ObjectId::parse_str(id_str) {
            filter.insert("_id", doc! { "$ne": oid });
        }
    }

    match data.debts_collection.find_one(filter, None).await {
        Ok(Some(_)) => HttpResponse::Ok().json(CheckNameResponse { exists: true }),
        Ok(None) => HttpResponse::Ok().json(CheckNameResponse { exists: false }),
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}
