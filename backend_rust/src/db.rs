use mongodb::{Client, Collection, options::ClientOptions, bson::doc};
use crate::models::{Debt, RecurringTransaction};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub debts_collection: Collection<Debt>,
    pub transactions_collection: Collection<RecurringTransaction>,
}

pub async fn init_db() -> AppState {
    let mongo_uri = env::var("MONGO_URI").unwrap_or_else(|_| "mongodb://mongo:27017/budget-app".to_string());
    println!("Connecting to MongoDB at {}", mongo_uri);

    let client_options = ClientOptions::parse(&mongo_uri).await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("budget-app");

    let debts_collection = db.collection::<Debt>("debts");
    let transactions_collection = db.collection::<RecurringTransaction>("recurringtransactions");

    // Ensure unique indexes
    let index_model = mongodb::IndexModel::builder()
        .keys(doc! { "name": 1 })
        .options(mongodb::options::IndexOptions::builder().unique(true).build())
        .build();
    
    let _ = debts_collection.create_index(index_model.clone(), None).await;
    let _ = transactions_collection.create_index(index_model, None).await;

    AppState {
        debts_collection,
        transactions_collection,
    }
}
