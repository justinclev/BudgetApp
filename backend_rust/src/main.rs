mod db;
mod handlers;
mod models;
mod utils;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use dotenv::dotenv;
use std::env;

use handlers::{
    debt_handler, generated_transaction_handler, health_handler, list_handler, todo_occurrence_handler,
    transaction_handler, user_handler,
};

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
            .route(
                "/api/debts/{id}",
                web::delete().to(debt_handler::delete_debt),
            )
            .route(
                "/api/debts/check-name/{name}",
                web::get().to(debt_handler::check_debt_name),
            )
            // Recurring Transaction Routes
            .route(
                "/api/recurring-transactions",
                web::get().to(transaction_handler::get_transactions),
            )
            .route(
                "/api/recurring-transactions",
                web::post().to(transaction_handler::create_transaction),
            )
            .route(
                "/api/recurring-transactions/{id}",
                web::put().to(transaction_handler::update_transaction),
            )
            .route(
                "/api/recurring-transactions/{id}",
                web::delete().to(transaction_handler::delete_transaction),
            )
            .route(
                "/api/recurring-transactions/check-name/{name}",
                web::get().to(transaction_handler::check_transaction_name),
            )
            // Generated Transaction Routes
            .route(
                "/api/transactions",
                web::get().to(generated_transaction_handler::get_generated_transactions),
            )
            .route(
                "/api/transactions",
                web::post().to(generated_transaction_handler::save_generated_transactions),
            )
            // List Routes
            .route("/api/lists", web::get().to(list_handler::get_lists))
            .route("/api/lists", web::post().to(list_handler::create_list))
            .route(
                "/api/lists/share/{token}",
                web::get().to(list_handler::get_list_by_share_token),
            )
            .route(
                "/api/lists/share/{token}/join",
                web::post().to(list_handler::join_list_by_share_token),
            )
            .route("/api/lists/{id}", web::get().to(list_handler::get_list))
            .route("/api/lists/{id}", web::put().to(list_handler::update_list))
            .route(
                "/api/lists/{id}",
                web::delete().to(list_handler::delete_list),
            )
            .route(
                "/api/lists/{id}/items",
                web::post().to(list_handler::add_item),
            )
            .route(
                "/api/lists/{id}/items/reorder",
                web::post().to(list_handler::reorder_items),
            )
            .route(
                "/api/lists/{id}/items/{item_id}/subitems",
                web::post().to(list_handler::add_sub_item),
            )
            .route(
                "/api/lists/{id}/items/{item_id}/subitems/{sub_id}/toggle",
                web::patch().to(list_handler::toggle_sub_item),
            )
            .route(
                "/api/lists/{id}/items/{item_id}/subitems/{sub_id}",
                web::patch().to(list_handler::update_sub_item_text),
            )
            .route(
                "/api/lists/{id}/items/{item_id}/subitems/{sub_id}",
                web::delete().to(list_handler::delete_sub_item),
            )
            .route(
                "/api/lists/{id}/members/{user_id}",
                web::delete().to(list_handler::remove_member),
            )
            .route(
                "/api/lists/{id}/items/{item_id}",
                web::delete().to(list_handler::delete_item),
            )
            .route(
                "/api/lists/{id}/items/{item_id}",
                web::patch().to(list_handler::update_item_text),
            )
            .route(
                "/api/lists/{id}/items/{item_id}/toggle",
                web::patch().to(list_handler::toggle_item),
            )
            .route(
                "/api/lists/{id}/items/{item_id}/complete-occurrence",
                web::patch().to(list_handler::complete_occurrence),
            )
            .route(
                "/api/lists/{id}/reset",
                web::post().to(list_handler::reset_list),
            )
            .route(
                "/api/lists/{id}/clone",
                web::post().to(list_handler::clone_list),
            )
            // User Routes
            .route("/api/users", web::get().to(user_handler::get_users))
            .route("/api/users/{id}", web::get().to(user_handler::get_user))
            .route("/api/users", web::post().to(user_handler::create_user))
            // Auth Routes
            .route("/api/auth/google", web::post().to(user_handler::google_auth))
            // Todo Occurrence Routes
            .route(
                "/api/todo-occurrences/generate",
                web::post().to(todo_occurrence_handler::generate_occurrences),
            )
            .route(
                "/api/todo-occurrences",
                web::get().to(todo_occurrence_handler::get_occurrences),
            )
            .route(
                "/api/todo-occurrences/{id}/toggle",
                web::patch().to(todo_occurrence_handler::toggle_occurrence),
            )
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
