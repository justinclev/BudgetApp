use crate::models::{Debt, RecurringTransaction, UserTransactions};
use mongodb::{bson::doc, options::ClientOptions, Client, Collection};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub debts_collection: Collection<Debt>,
    pub transactions_collection: Collection<RecurringTransaction>,
    pub generated_transactions_collection: Collection<UserTransactions>,
}

pub async fn init_db() -> AppState {
    let mongo_uri = env::var("MONGO_URI").unwrap_or_else(|_| "mongodb+srv://admin:DS6Wx2qIWVeXCQMP@budgetflowdb.anhdnhq.mongodb.net/?appName=BudgetFlowDB".to_string());
    println!("Connecting to MongoDB at {}", mongo_uri);

    let client_options = ClientOptions::parse(&mongo_uri).await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("budget-app");

    let debts_collection = db.collection::<Debt>("debts");
    let transactions_collection = db.collection::<RecurringTransaction>("recurringtransactions");
    let generated_transactions_collection = db.collection::<UserTransactions>("transactions");

    // Ensure unique indexes
    let index_model = mongodb::IndexModel::builder()
        .keys(doc! { "name": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();

    let _ = debts_collection
        .create_index(index_model.clone(), None)
        .await;
    let _ = transactions_collection
        .create_index(index_model, None)
        .await;

    AppState {
        debts_collection,
        transactions_collection,
        generated_transactions_collection,
    }
}
