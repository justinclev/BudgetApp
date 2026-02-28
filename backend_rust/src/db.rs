use crate::models::{Debt, RecurringTransaction, UserList, UserTransactions};
use mongodb::{bson::doc, options::ClientOptions, Client, Collection};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub debts_collection: Collection<Debt>,
    pub transactions_collection: Collection<RecurringTransaction>,
    pub generated_transactions_collection: Collection<UserTransactions>,
    pub lists_collection: Collection<UserList>,
}

pub async fn init_db() -> AppState {
    let mongo_uri = env::var("MONGO_URI").unwrap_or_else(|_| "mongodb+srv://admin:I98gw2zKiEn8iMov@budgetflowdb.anhdnhq.mongodb.net/?appName=BudgetFlowDB".to_string());
    println!("Connecting to MongoDB at {}", mongo_uri);

    let client_options = ClientOptions::parse(&mongo_uri).await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let db = client.database("budget-app");

    let debts_collection = db.collection::<Debt>("debts");
    let transactions_collection = db.collection::<RecurringTransaction>("recurringtransactions");
    let generated_transactions_collection = db.collection::<UserTransactions>("transactions");
    let lists_collection = db.collection::<UserList>("lists");

    // ── Migration: stamp pre-user-isolation docs with Alice's ID (no data loss) ──
    let alice_id = "123";
    let _ = debts_collection
        .update_many(
            doc! { "user_id": { "$exists": false } },
            doc! { "$set": { "user_id": alice_id } },
            None,
        )
        .await;
    let _ = transactions_collection
        .update_many(
            doc! { "user_id": { "$exists": false } },
            doc! { "$set": { "user_id": alice_id } },
            None,
        )
        .await;
    // generated_transactions used "default" as user key before
    let _ = generated_transactions_collection
        .update_many(
            doc! { "user": "default" },
            doc! { "$set": { "user": alice_id } },
            None,
        )
        .await;

    // Drop old name-only unique index; names are now unique per user
    let _ = debts_collection.drop_index("name_1", None).await;
    let _ = transactions_collection.drop_index("name_1", None).await;

    // Compound unique index: (name, user_id)
    let index_model = mongodb::IndexModel::builder()
        .keys(doc! { "name": 1, "user_id": 1 })
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

    // Index lists by shareToken for fast lookup
    let share_token_index = mongodb::IndexModel::builder()
        .keys(doc! { "shareToken": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();
    let _ = lists_collection.create_index(share_token_index, None).await;

    AppState {
        debts_collection,
        transactions_collection,
        generated_transactions_collection,
        lists_collection,
    }
}
