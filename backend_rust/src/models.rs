use crate::utils::{
    deserialize_datetime_from_bson, deserialize_f64_from_bson_number, deserialize_oid_from_hex,
    deserialize_option_datetime_from_bson, deserialize_option_f64_from_bson_number,
    serialize_oid_as_hex,
};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Debt {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(rename = "createdByUserId", default)]
    pub created_by_user_id: String,
    #[serde(
        rename = "amountOwed",
        deserialize_with = "deserialize_f64_from_bson_number"
    )]
    pub amount_owed: f64,
    #[serde(
        rename = "interestRate",
        deserialize_with = "deserialize_f64_from_bson_number"
    )]
    pub interest_rate: f64,
    #[serde(
        rename = "minimumPayment",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_f64_from_bson_number",
        default
    )]
    pub minimum_payment: Option<f64>,
    #[serde(
        rename = "paymentDate",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_datetime_from_bson",
        default
    )]
    pub payment_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecurringTransaction {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(rename = "createdByUserId", default)]
    pub created_by_user_id: String,
    pub description: String,
    #[serde(deserialize_with = "deserialize_f64_from_bson_number")]
    pub amount: f64,
    pub frequency: String,
    #[serde(
        rename = "startingDate",
        deserialize_with = "deserialize_datetime_from_bson"
    )]
    pub starting_date: chrono::DateTime<chrono::Utc>,
    #[serde(
        rename = "linkedDebtId",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub linked_debt_id: Option<ObjectId>,
    #[serde(rename = "type", default = "default_recurring_type")]
    pub transaction_type: String,
}

fn default_recurring_type() -> String {
    "expense".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: String,
    #[serde(deserialize_with = "deserialize_f64_from_bson_number")]
    pub amount: f64,
    #[serde(deserialize_with = "deserialize_datetime_from_bson")]
    pub date: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "type")]
    pub transaction_type: String,
    #[serde(rename = "referenceId", skip_serializing_if = "Option::is_none")]
    pub reference_id: Option<String>,
    #[serde(
        rename = "startingBalance",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_f64_from_bson_number",
        default
    )]
    pub starting_balance: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub deleted: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserTransactions {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    #[serde(rename = "createdByUserId")]
    pub created_by_user_id: String,
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Serialize)]
pub struct CheckNameResponse {
    pub exists: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    pub name: String,
    pub email: String,
    #[serde(rename = "googleId", skip_serializing_if = "Option::is_none", default)]
    pub google_id: Option<String>,
    #[serde(rename = "avatarUrl", skip_serializing_if = "Option::is_none", default)]
    pub avatar_url: Option<String>,
    #[serde(
        rename = "lastLogin",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_datetime_from_bson",
        default
    )]
    pub last_login: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(
        rename = "createdAt",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_datetime_from_bson",
        default
    )]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Personal API token used by voice assistants — generated on first request.
    #[serde(rename = "voiceToken", skip_serializing_if = "Option::is_none", default)]
    pub voice_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleAuthRequest {
    pub credential: String,
}

// ── List App Models ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubItem {
    pub id: String,
    pub text: String,
    pub completed: bool,
    #[serde(
        rename = "createdAt",
        deserialize_with = "deserialize_datetime_from_bson"
    )]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListItem {
    pub id: String,
    pub text: String,
    pub completed: bool,
    #[serde(
        rename = "completedByUserId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub completed_by_user_id: Option<String>,
    /// Date-only string (YYYY-MM-DD) of the most recently completed recurrence occurrence.
    #[serde(
        rename = "lastCompletedAt",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub last_completed_at: Option<String>,
    #[serde(
        rename = "lastCompletedByUserId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub last_completed_by_user_id: Option<String>,
    #[serde(
        rename = "createdAt",
        deserialize_with = "deserialize_datetime_from_bson"
    )]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "subItems", default)]
    pub sub_items: Vec<SubItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserList {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(rename = "listType")]
    pub list_type: String,
    #[serde(rename = "ownerId")]
    pub owner_id: String,
    #[serde(rename = "createdByUserId", default)]
    pub created_by_user_id: String,
    #[serde(rename = "authorizedUsers", default)]
    pub authorized_users: Vec<String>,
    #[serde(default)]
    pub items: Vec<ListItem>,
    #[serde(rename = "shareToken")]
    pub share_token: String,
    #[serde(
        rename = "createdAt",
        deserialize_with = "deserialize_datetime_from_bson"
    )]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(
        rename = "completeByDate",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_datetime_from_bson",
        default
    )]
    pub complete_by_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(
        rename = "repeatFrequency",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub repeat_frequency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateListRequest {
    pub name: String,
    #[serde(rename = "listType")]
    pub list_type: String,
    #[serde(rename = "ownerId")]
    pub owner_id: String,
    #[serde(
        rename = "completeByDate",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub complete_by_date: Option<String>,
    #[serde(
        rename = "repeatFrequency",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub repeat_frequency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateListRequest {
    pub name: String,
    #[serde(rename = "listType")]
    pub list_type: String,
    #[serde(
        rename = "completeByDate",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub complete_by_date: Option<String>,
    #[serde(
        rename = "repeatFrequency",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub repeat_frequency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddItemRequest {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReorderItemsRequest {
    #[serde(rename = "itemIds")]
    pub item_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveUserRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateItemRequest {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinListRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToggleItemRequest {
    #[serde(rename = "userId", default)]
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompleteOccurrenceRequest {
    /// YYYY-MM-DD date of the occurrence being toggled.
    pub date: String,
    #[serde(rename = "userId", default)]
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloneListRequest {
    #[serde(rename = "ownerId")]
    pub owner_id: String,
    pub name: Option<String>,
}

// ── Todo Occurrence Models ─────────────────────────────────────────────────

/// A concrete calendar occurrence of a todo list item for a specific date.
/// Stored in the `todo_occurrences` collection.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoOccurrence {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "serialize_oid_as_hex",
        deserialize_with = "deserialize_oid_from_hex",
        default
    )]
    pub id: Option<ObjectId>,
    #[serde(rename = "listId")]
    pub list_id: String,
    #[serde(rename = "itemId")]
    pub item_id: String,
    #[serde(rename = "itemText")]
    pub item_text: String,
    #[serde(rename = "listName")]
    pub list_name: String,
    /// YYYY-MM-DD of this occurrence.
    #[serde(rename = "occurrenceDate")]
    pub occurrence_date: String,
    pub completed: bool,
    #[serde(
        rename = "completedByUserId",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub completed_by_user_id: Option<String>,
    #[serde(
        rename = "completedByName",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub completed_by_name: Option<String>,
    #[serde(
        rename = "completedAt",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_datetime_from_bson",
        default
    )]
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(rename = "ownerId")]
    pub owner_id: String,
    #[serde(
        rename = "repeatFrequency",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub repeat_frequency: Option<String>,
    /// Original list completeByDate as YYYY-MM-DD, None means undated list.
    #[serde(
        rename = "listDueDate",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub list_due_date: Option<String>,
    #[serde(
        rename = "createdAt",
        deserialize_with = "deserialize_datetime_from_bson"
    )]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateOccurrencesRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    /// YYYY-MM-DD inclusive start of the date window to generate.
    #[serde(rename = "startDate")]
    pub start_date: String,
    /// YYYY-MM-DD inclusive end.
    #[serde(rename = "endDate")]
    pub end_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToggleOccurrenceRequest {
    #[serde(rename = "userId", default)]
    pub user_id: Option<String>,
}
