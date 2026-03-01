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

/// Deserializes a required BSON DateTime into `chrono::DateTime<Utc>`.
/// Uses `mongodb::bson::DateTime` directly so the BSON driver's native
/// deserializer handles the wire format correctly.
pub fn deserialize_datetime_from_bson<'de, D>(
    deserializer: D,
) -> Result<chrono::DateTime<chrono::Utc>, D::Error>
where
    D: Deserializer<'de>,
{
    mongodb::bson::DateTime::deserialize(deserializer).map(|dt| dt.to_chrono())
}

/// Deserializes an optional BSON DateTime into `Option<chrono::DateTime<Utc>>`.
/// Uses `mongodb::bson::DateTime` directly so the BSON driver's native
/// deserializer handles the wire format correctly.
pub fn deserialize_option_datetime_from_bson<'de, D>(
    deserializer: D,
) -> Result<Option<chrono::DateTime<chrono::Utc>>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<mongodb::bson::DateTime>::deserialize(deserializer)
        .map(|opt| opt.map(|dt| dt.to_chrono()))
}
