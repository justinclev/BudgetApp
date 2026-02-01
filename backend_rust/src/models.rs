use crate::utils::{
    deserialize_f64_from_bson_number, deserialize_oid_from_hex,
    deserialize_option_f64_from_bson_number, serialize_oid_as_hex,
};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Debt {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none", serialize_with = "serialize_oid_as_hex", deserialize_with = "deserialize_oid_from_hex", default)]
    pub id: Option<ObjectId>,
    pub name: String,
    #[serde(rename = "amountOwed", deserialize_with = "deserialize_f64_from_bson_number")]
    pub amount_owed: f64,
    #[serde(rename = "interestRate", deserialize_with = "deserialize_f64_from_bson_number")]
    pub interest_rate: f64,
    #[serde(rename = "minimumPayment", skip_serializing_if = "Option::is_none", deserialize_with = "deserialize_option_f64_from_bson_number", default)]
    pub minimum_payment: Option<f64>,
    #[serde(rename = "paymentDate", skip_serializing_if = "Option::is_none")]
    pub payment_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecurringTransaction {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none", serialize_with = "serialize_oid_as_hex", deserialize_with = "deserialize_oid_from_hex", default)]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: String,
    #[serde(deserialize_with = "deserialize_f64_from_bson_number")]
    pub amount: f64,
    pub frequency: String,
    #[serde(rename = "startingDate")]
    pub starting_date: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "linkedDebtId", skip_serializing_if = "Option::is_none", serialize_with = "serialize_oid_as_hex", deserialize_with = "deserialize_oid_from_hex", default)]
    pub linked_debt_id: Option<ObjectId>,
    #[serde(rename = "type", default = "default_recurring_type")]
    pub transaction_type: String,
}

fn default_recurring_type() -> String {
    "expense".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none", serialize_with = "serialize_oid_as_hex", deserialize_with = "deserialize_oid_from_hex", default)]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: String,
    #[serde(deserialize_with = "deserialize_f64_from_bson_number")]
    pub amount: f64,
    pub date: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "type")]
    pub transaction_type: String,
    #[serde(rename = "referenceId", skip_serializing_if = "Option::is_none")]
    pub reference_id: Option<String>,
    #[serde(rename = "startingBalance", skip_serializing_if = "Option::is_none", deserialize_with = "deserialize_option_f64_from_bson_number", default)]
    pub starting_balance: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserTransactions {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none", serialize_with = "serialize_oid_as_hex", deserialize_with = "deserialize_oid_from_hex", default)]
    pub id: Option<ObjectId>,
    pub user: String,
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Serialize)]
pub struct CheckNameResponse {
    pub exists: bool,
}
