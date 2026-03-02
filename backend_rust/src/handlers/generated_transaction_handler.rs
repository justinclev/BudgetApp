use actix_web::{web, HttpRequest, HttpResponse, Responder};
use mongodb::bson::doc;
use crate::models::{UserTransactions, Transaction};
use crate::db::AppState;

fn extract_user_id(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

pub async fn get_generated_transactions(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    match data.generated_transactions_collection.find_one(doc! { "createdByUserId": &user_id }, None).await {
        Ok(Some(user_transactions)) => HttpResponse::Ok().json(user_transactions.transactions),
        Ok(None) => HttpResponse::Ok().json(Vec::<Transaction>::new()),
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}

pub async fn save_generated_transactions(
    req: HttpRequest,
    data: web::Data<AppState>,
    transactions: web::Json<Vec<Transaction>>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().body("Missing X-User-Id header"),
    };
    let transaction_list = transactions.into_inner();

    let filter = doc! { "createdByUserId": &user_id };

    let transactions_bson = match mongodb::bson::to_bson(&transaction_list) {
        Ok(b) => b,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let update = doc! {
        "$set": { "transactions": transactions_bson },
        "$setOnInsert": { "createdByUserId": &user_id }
    };
    
    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();

    match data.generated_transactions_collection.update_one(filter, update, options).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Transactions saved successfully" })),
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}
