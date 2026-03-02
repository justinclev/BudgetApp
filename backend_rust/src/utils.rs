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
