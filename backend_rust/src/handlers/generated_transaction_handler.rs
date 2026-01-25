use actix_web::{web, HttpResponse, Responder};
use mongodb::bson::doc;
use crate::models::{UserTransactions, Transaction};
use crate::db::AppState;

pub async fn get_generated_transactions(data: web::Data<AppState>) -> impl Responder {
    // Hardcoded user "default" for now
    match data.generated_transactions_collection.find_one(doc! { "user": "default" }, None).await {
        Ok(Some(user_transactions)) => HttpResponse::Ok().json(user_transactions.transactions),
        Ok(None) => HttpResponse::Ok().json(Vec::<Transaction>::new()),
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}

pub async fn save_generated_transactions(
    data: web::Data<AppState>,
    transactions: web::Json<Vec<Transaction>>,
) -> impl Responder {
    let transaction_list = transactions.into_inner();
    
    // Create or update the document for user "default"
    // Using update_one with upsert=true
    let filter = doc! { "user": "default" };
    
    // We need to serialize the transaction list to BSON to put it in $set
    let transactions_bson = match mongodb::bson::to_bson(&transaction_list) {
        Ok(b) => b,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let update = doc! { 
        "$set": { "transactions": transactions_bson },
        "$setOnInsert": { "user": "default" }
    };
    
    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();

    match data.generated_transactions_collection.update_one(filter, update, options).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Transactions saved successfully" })),
        Err(err) => HttpResponse::InternalServerError().body(err.to_string()),
    }
}
