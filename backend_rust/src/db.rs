use crate::models::{Debt, RecurringTransaction, User, UserList, UserTransactions};
use mongodb::{bson::doc, options::ClientOptions, Client, Collection};
use std::env;

#[derive(Clone)]
pub struct AppState {
    pub debts_collection: Collection<Debt>,
    pub transactions_collection: Collection<RecurringTransaction>,
    pub generated_transactions_collection: Collection<UserTransactions>,
    pub lists_collection: Collection<UserList>,
    pub users_collection: Collection<User>,
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
    let users_collection = db.collection::<User>("users");

    // ── Users: unique email index + seed dev accounts ──────────────────────────
    let email_index = mongodb::IndexModel::builder()
        .keys(doc! { "email": 1 })
        .options(
            mongodb::options::IndexOptions::builder()
                .unique(true)
                .build(),
        )
        .build();
    let _ = users_collection.create_index(email_index, None).await;

    // Seed Alice (upsert so re-deploys are safe)
    let alice_oid = mongodb::bson::oid::ObjectId::parse_str("507f1f77bcf86cd799439011").unwrap();
    let _ = users_collection.update_one(
        doc! { "_id": alice_oid },
        doc! { "$setOnInsert": {
            "_id": alice_oid,
            "name": "Alice",
            "email": "alice@example.com",
            "createdAt": chrono::Utc::now()
        }},
        mongodb::options::UpdateOptions::builder().upsert(true).build(),
    ).await;

    // Seed Bob (upsert so re-deploys are safe)
    let bob_oid = mongodb::bson::oid::ObjectId::parse_str("507f1f77bcf86cd799439012").unwrap();
    let _ = users_collection.update_one(
        doc! { "_id": bob_oid },
        doc! { "$setOnInsert": {
            "_id": bob_oid,
            "name": "Bob",
            "email": "bob@example.com",
            "createdAt": chrono::Utc::now()
        }},
        mongodb::options::UpdateOptions::builder().upsert(true).build(),
    ).await;
    // Alice's canonical MongoDB ObjectId (matches login.component.ts)
    let alice_id = "507f1f77bcf86cd799439011";

    // debts: old field was "user_id" (string "123"), rename & re-stamp
    let _ = debts_collection
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await;
    // handle docs that still have the old field name from previous migration
    let _ = debts_collection
        .update_many(
            doc! { "user_id": { "$exists": true } },
            doc! { "$rename": { "user_id": "createdByUserId" } },
            None,
        )
        .await;

    let _ = transactions_collection
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await;
    let _ = transactions_collection
        .update_many(
            doc! { "user_id": { "$exists": true } },
            doc! { "$rename": { "user_id": "createdByUserId" } },
            None,
        )
        .await;

    // generated_transactions: old field was "user" with value "default" or "123"
    let _ = generated_transactions_collection
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await;
    let _ = generated_transactions_collection
        .update_many(
            doc! { "user": { "$exists": true } },
            doc! { "$unset": { "user": "" } },
            None,
        )
        .await;

    // lists: copy ownerId → createdByUserId where missing
    // (can't use $rename since we keep ownerId too)
    let _ = lists_collection
        .update_many(
            doc! { "createdByUserId": { "$exists": false } },
            doc! { "$set": { "createdByUserId": alice_id } },
            None,
        )
        .await;

    // Drop old indexes and create compound (name, createdByUserId)
    let _ = debts_collection.drop_index("name_1", None).await;
    let _ = debts_collection.drop_index("name_1_user_id_1", None).await;
    let _ = transactions_collection.drop_index("name_1", None).await;
    let _ = transactions_collection.drop_index("name_1_user_id_1", None).await;

    let index_model = mongodb::IndexModel::builder()
        .keys(doc! { "name": 1, "createdByUserId": 1 })
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
        users_collection,
    }
}
