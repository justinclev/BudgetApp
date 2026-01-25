mod models;
mod handlers;
mod db;
mod utils;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use dotenv::dotenv;
use std::env;

use handlers::{debt_handler, transaction_handler, health_handler, generated_transaction_handler};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    
    // Initialize DB
    let app_state = db::init_db().await;

    println!("Server starting on port {}", port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(app_state.clone()))
            .route("/", web::get().to(health_handler::health_check))
            // Debt Routes
            .route("/api/debts", web::get().to(debt_handler::get_debts))
            .route("/api/debts", web::post().to(debt_handler::create_debt))
            .route("/api/debts/{id}", web::put().to(debt_handler::update_debt))
            .route("/api/debts/{id}", web::delete().to(debt_handler::delete_debt))
            .route("/api/debts/check-name/{name}", web::get().to(debt_handler::check_debt_name))
            // Recurring Transaction Routes
            .route("/api/recurring-transactions", web::get().to(transaction_handler::get_transactions))
            .route("/api/recurring-transactions", web::post().to(transaction_handler::create_transaction))
            .route("/api/recurring-transactions/{id}", web::put().to(transaction_handler::update_transaction))
            .route("/api/recurring-transactions/{id}", web::delete().to(transaction_handler::delete_transaction))
            .route("/api/recurring-transactions/check-name/{name}", web::get().to(transaction_handler::check_transaction_name))
            // Generated Transaction Routes
            .route("/api/transactions", web::get().to(generated_transaction_handler::get_generated_transactions))
            .route("/api/transactions", web::post().to(generated_transaction_handler::save_generated_transactions))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}