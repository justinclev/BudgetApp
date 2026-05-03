use crate::models::{Debt, RecurringTransaction, TodoOccurrence, User, UserList, UserTransactions};
use mongodb::{bson::doc, options::ClientOptions, Client, Collection};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub debts_collection: Collection<Debt>,
    pub transactions_collection: Collection<RecurringTransaction>,
    pub generated_transactions_collection: Collection<UserTransactions>,
    pub lists_collection: Collection<UserList>,
    pub users_collection: Collection<User>,
    pub todo_occurrences_collection: Collection<TodoOccurrence>,
    /// HS256 secret used to sign and verify JWTs.
    pub jwt_secret: String,
}

pub async fn init_db() -> Result<AppState, Box<dyn std::error::Error>> {
    let mongo_uri = env::var("MONGO_URI")
        .map_err(|_| "MONGO_URI environment variable must be set")?;
    let jwt_secret = env::var("JWT_SECRET")
        .map_err(|_| "JWT_SECRET environment variable must be set")?;

    if jwt_secret.len() < 32 {
        return Err("JWT_SECRET must be at least 32 characters".into());
    }

    println!("Connecting to MongoDB…");

    let client_options = ClientOptions::parse(&mongo_uri).await?;
    let client = Client::with_options(client_options)?;
    let db = client.database("budget-app");

    let debts_collection = db.collection::<Debt>("debts");
    let transactions_collection = db.collection::<RecurringTransaction>("recurringtransactions");
    let generated_transactions_collection = db.collection::<UserTransactions>("transactions");
    let lists_collection = db.collection::<UserList>("lists");
    let users_collection = db.collection::<User>("users");
    let todo_occurrences_collection = db.collection::<TodoOccurrence>("todo_occurrences");

    // ── Indexes ────────────────────────────────────────────────────────────────

    // Unique occurrence per (list, item, date)
    let occ_index = mongodb::IndexModel::builder()
        .keys(doc! { "listId": 1, "itemId": 1, "occurrenceDate": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();
    let _ = todo_occurrences_collection.create_index(occ_index, None).await;

    // Unique email per user
    let email_index = mongodb::IndexModel::builder()
        .keys(doc! { "email": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();
    let _ = users_collection.create_index(email_index, None).await;

    // Compound (name, createdByUserId) uniqueness on debts + transactions
    let _ = debts_collection.drop_index("name_1", None).await;
    let _ = debts_collection.drop_index("name_1_user_id_1", None).await;
    let _ = transactions_collection.drop_index("name_1", None).await;
    let _ = transactions_collection.drop_index("name_1_user_id_1", None).await;

    let name_user_index = mongodb::IndexModel::builder()
        .keys(doc! { "name": 1, "createdByUserId": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();
    let _ = debts_collection.create_index(name_user_index.clone(), None).await;
    let _ = transactions_collection.create_index(name_user_index, None).await;

    // Unique shareToken on lists
    let share_token_index = mongodb::IndexModel::builder()
        .keys(doc! { "shareToken": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();
    let _ = lists_collection.create_index(share_token_index, None).await;

    Ok(AppState {
        debts_collection,
        transactions_collection,
        generated_transactions_collection,
        lists_collection,
        users_collection,
        todo_occurrences_collection,
        jwt_secret,
    })
}
