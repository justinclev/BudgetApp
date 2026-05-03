//! Development seed + one-time data-migration script.
//!
//! Run with:
//!   cargo run --bin seed
//!
//! Requires MONGO_URI to be set (via .env or environment).
//! Safe to re-run — all writes use upsert or `$setOnInsert`.

use dotenv::dotenv;
use mongodb::{bson::doc, options::ClientOptions, Client};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let mongo_uri = env::var("MONGO_URI")
        .map_err(|_| "MONGO_URI environment variable must be set")?;

    let client_options = ClientOptions::parse(&mongo_uri).await?;
    let client = Client::with_options(client_options)?;
    let db = client.database("budget-app");

    let users = db.collection::<mongodb::bson::Document>("users");
    let debts = db.collection::<mongodb::bson::Document>("debts");
    let transactions = db.collection::<mongodb::bson::Document>("recurringtransactions");
    let generated = db.collection::<mongodb::bson::Document>("transactions");
    let lists = db.collection::<mongodb::bson::Document>("lists");

    // ── Seed dev accounts ──────────────────────────────────────────────────────
    let dev_users = vec![
        ("507f1f77bcf86cd799439011", "Alice", "alice@example.com"),
        ("507f1f77bcf86cd799439012", "Bob", "bob@example.com"),
    ];

    for (id_str, name, email) in &dev_users {
        let oid = mongodb::bson::oid::ObjectId::parse_str(id_str)?;
        let result = users
            .update_one(
                doc! { "_id": oid },
                doc! { "$setOnInsert": {
                    "_id": oid,
                    "name": name,
                    "email": email,
                    "createdAt": chrono::Utc::now()
                }},
                mongodb::options::UpdateOptions::builder()
                    .upsert(true)
                    .build(),
            )
            .await?;

        if result.upserted_id.is_some() {
            println!("Seeded user: {}", name);
        } else {
            println!("User {} already exists — skipped.", name);
        }
    }

    // ── One-time field migrations ──────────────────────────────────────────────
    //
    // These normalise documents written by older versions of the app.
    // They are idempotent and will no-op once the database is clean.

    let alice_id = "507f1f77bcf86cd799439011";

    // debts: back-fill createdByUserId and rename legacy user_id field
    debts
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await?;
    debts
        .update_many(
            doc! { "user_id": { "$exists": true } },
            doc! { "$rename": { "user_id": "createdByUserId" } },
            None,
        )
        .await?;

    // recurring transactions
    transactions
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await?;
    transactions
        .update_many(
            doc! { "user_id": { "$exists": true } },
            doc! { "$rename": { "user_id": "createdByUserId" } },
            None,
        )
        .await?;

    // generated transactions
    generated
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await?;
    generated
        .update_many(
            doc! { "user": { "$exists": true } },
            doc! { "$unset": { "user": "" } },
            None,
        )
        .await?;

    // lists
    lists
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await?;

    println!("Migrations complete.");
    Ok(())
}
