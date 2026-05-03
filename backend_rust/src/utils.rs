use mongodb::bson::oid::ObjectId;
use mongodb::bson::Bson;
use serde::{Deserialize, Deserializer, Serializer};

pub fn serialize_oid_as_hex<S>(oid: &Option<ObjectId>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match oid {
        Some(id) => serializer.serialize_str(&id.to_hex()),
        None => serializer.serialize_none(),
    }
}

pub fn deserialize_oid_from_hex<'de, D>(deserializer: D) -> Result<Option<ObjectId>, D::Error>
where
    D: Deserializer<'de>,
{
    let bson = Bson::deserialize(deserializer)?;
    match bson {
        Bson::ObjectId(oid) => Ok(Some(oid)),
        Bson::String(s) => {
            if s.is_empty() {
                return Ok(None);
            }
            ObjectId::parse_str(&s)
                .map(Some)
                .map_err(serde::de::Error::custom)
        }
        Bson::Null => Ok(None),
        _ => Err(serde::de::Error::custom("Expected ObjectId or Hex String")),
    }
}

pub fn deserialize_f64_from_bson_number<'de, D>(deserializer: D) -> Result<f64, D::Error>
where
    D: Deserializer<'de>,
{
    let bson = Bson::deserialize(deserializer)?;
    match bson {
        Bson::Double(v) => Ok(v),
        Bson::Int32(v) => Ok(v as f64),
        Bson::Int64(v) => Ok(v as f64),
        _ => Err(serde::de::Error::custom(
            "Expected a number (Double, Int32, or Int64)",
        )),
    }
}

pub fn deserialize_option_f64_from_bson_number<'de, D>(
    deserializer: D,
) -> Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt_bson: Option<Bson> = Option::deserialize(deserializer)?;
    match opt_bson {
        Some(Bson::Double(v)) => Ok(Some(v)),
        Some(Bson::Int32(v)) => Ok(Some(v as f64)),
        Some(Bson::Int64(v)) => Ok(Some(v as f64)),
        Some(Bson::Null) | None => Ok(None),
        _ => Err(serde::de::Error::custom("Expected a number or null")),
    }
}

/// Deserializes a required DateTime from either a BSON DateTime (MongoDB
/// cursor) or an RFC 3339 string (JSON request body from the frontend).
pub fn deserialize_datetime_from_bson<'de, D>(
    deserializer: D,
) -> Result<chrono::DateTime<chrono::Utc>, D::Error>
where
    D: Deserializer<'de>,
{
    match Bson::deserialize(deserializer)? {
        Bson::DateTime(dt) => Ok(dt.to_chrono()),
        Bson::String(s) => chrono::DateTime::parse_from_rfc3339(&s)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .map_err(serde::de::Error::custom),
        other => Err(serde::de::Error::custom(format!(
            "expected DateTime or RFC 3339 string, got {:?}",
            other
        ))),
    }
}

/// Deserializes an optional DateTime from a BSON DateTime, RFC 3339 string,
/// or null/missing field.
pub fn deserialize_option_datetime_from_bson<'de, D>(
    deserializer: D,
) -> Result<Option<chrono::DateTime<chrono::Utc>>, D::Error>
where
    D: Deserializer<'de>,
{
    match Bson::deserialize(deserializer)? {
        Bson::DateTime(dt) => Ok(Some(dt.to_chrono())),
        Bson::String(s) if !s.is_empty() => chrono::DateTime::parse_from_rfc3339(&s)
            .map(|dt| Some(dt.with_timezone(&chrono::Utc)))
            .map_err(serde::de::Error::custom),
        Bson::String(_) | Bson::Null => Ok(None),
        other => Err(serde::de::Error::custom(format!(
            "expected DateTime, RFC 3339 string, or null, got {:?}",
            other
        ))),
    }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

/// Extracts the `X-User-Id` header value from an incoming request.
/// Shared by all handlers that require per-user data scoping.
pub fn extract_user_id(req: &actix_web::HttpRequest) -> Option<String> {
    req.headers()
        .get("X-User-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;
    use serde::{Deserialize, Serialize};
    use serde_json::json;

    // Helper: deserialize a JSON value through serde_json into a BSON-backed struct.
    fn from_json<T: for<'de> Deserialize<'de>>(v: serde_json::Value) -> T {
        serde_json::from_value(v).expect("deserialize failed")
    }

    // ── deserialize_f64_from_bson_number ──────────────────────────────────────

    #[derive(Deserialize)]
    struct F64Wrapper {
        #[serde(deserialize_with = "deserialize_f64_from_bson_number")]
        value: f64,
    }

    #[test]
    fn f64_from_integer_json() {
        let w: F64Wrapper = from_json(json!({ "value": 42 }));
        assert_eq!(w.value, 42.0);
    }

    #[test]
    fn f64_from_float_json() {
        let w: F64Wrapper = from_json(json!({ "value": 3.14 }));
        assert!((w.value - 3.14).abs() < 1e-9);
    }

    // ── deserialize_option_f64_from_bson_number ───────────────────────────────

    #[derive(Deserialize)]
    struct OptionF64Wrapper {
        #[serde(
            deserialize_with = "deserialize_option_f64_from_bson_number",
            default
        )]
        value: Option<f64>,
    }

    #[test]
    fn option_f64_from_null_json() {
        let w: OptionF64Wrapper = from_json(json!({ "value": null }));
        assert!(w.value.is_none());
    }

    #[test]
    fn option_f64_from_absent_field() {
        let w: OptionF64Wrapper = from_json(json!({}));
        assert!(w.value.is_none());
    }

    #[test]
    fn option_f64_from_integer_json() {
        let w: OptionF64Wrapper = from_json(json!({ "value": 100 }));
        assert_eq!(w.value, Some(100.0));
    }

    // ── deserialize_datetime_from_bson ────────────────────────────────────────

    #[derive(Deserialize)]
    struct DateWrapper {
        #[serde(deserialize_with = "deserialize_datetime_from_bson")]
        date: chrono::DateTime<chrono::Utc>,
    }

    #[test]
    fn datetime_from_rfc3339_string() {
        let w: DateWrapper = from_json(json!({ "date": "2024-01-15T12:00:00Z" }));
        assert_eq!(w.date.year(), 2024);
        assert_eq!(w.date.month(), 1);
        assert_eq!(w.date.day(), 15);
    }

    // ── serialize_oid_as_hex ──────────────────────────────────────────────────

    #[derive(Serialize, Deserialize)]
    struct OidWrapper {
        #[serde(
            rename = "_id",
            skip_serializing_if = "Option::is_none",
            serialize_with = "serialize_oid_as_hex",
            deserialize_with = "deserialize_oid_from_hex",
            default
        )]
        id: Option<mongodb::bson::oid::ObjectId>,
    }

    #[test]
    fn oid_round_trip() {
        use mongodb::bson::oid::ObjectId;
        let oid = ObjectId::parse_str("507f1f77bcf86cd799439011").unwrap();
        let wrapper = OidWrapper { id: Some(oid) };
        let json = serde_json::to_string(&wrapper).expect("serialize");
        assert!(json.contains("507f1f77bcf86cd799439011"));

        let back: OidWrapper = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.id.unwrap().to_hex(), "507f1f77bcf86cd799439011");
    }

    #[test]
    fn oid_none_serializes_to_absent_key() {
        let wrapper = OidWrapper { id: None };
        let json = serde_json::to_string(&wrapper).expect("serialize");
        // skip_serializing_if = "Option::is_none" means the key should be missing
        assert!(!json.contains("_id"));
    }
}
