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

/// Deserializes a required DateTime from either:
/// - BSON DateTime (MongoDB cursor) — driver calls visit_i64 with millis
/// - RFC 3339 string (JSON request body from frontend)
pub fn deserialize_datetime_from_bson<'de, D>(
    deserializer: D,
) -> Result<chrono::DateTime<chrono::Utc>, D::Error>
where
    D: Deserializer<'de>,
{
    struct DateTimeVisitor;

    impl<'de> serde::de::Visitor<'de> for DateTimeVisitor {
        type Value = chrono::DateTime<chrono::Utc>;

        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a BSON DateTime or RFC 3339 string")
        }

        // BSON DateTime arrives as i64 milliseconds from the MongoDB driver
        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(mongodb::bson::DateTime::from_millis(v).to_chrono())
        }

        // JSON string from frontend (RFC 3339)
        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            chrono::DateTime::parse_from_rfc3339(v)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .map_err(serde::de::Error::custom)
        }
    }

    deserializer.deserialize_any(DateTimeVisitor)
}

/// Deserializes an optional DateTime from either:
/// - BSON DateTime (MongoDB cursor) — driver calls visit_i64 with millis
/// - RFC 3339 string (JSON request body from frontend)
/// - null / missing field
pub fn deserialize_option_datetime_from_bson<'de, D>(
    deserializer: D,
) -> Result<Option<chrono::DateTime<chrono::Utc>>, D::Error>
where
    D: Deserializer<'de>,
{
    struct OptDateTimeVisitor;

    impl<'de> serde::de::Visitor<'de> for OptDateTimeVisitor {
        type Value = Option<chrono::DateTime<chrono::Utc>>;

        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a BSON DateTime, RFC 3339 string, or null")
        }

        fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        // BSON DateTime arrives as i64 milliseconds from the MongoDB driver
        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(mongodb::bson::DateTime::from_millis(v).to_chrono()))
        }

        // JSON string from frontend (RFC 3339)
        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            if v.is_empty() {
                return Ok(None);
            }
            chrono::DateTime::parse_from_rfc3339(v)
                .map(|dt| Some(dt.with_timezone(&chrono::Utc)))
                .map_err(serde::de::Error::custom)
        }

        fn visit_some<D2: Deserializer<'de>>(self, d: D2) -> Result<Self::Value, D2::Error> {
            deserialize_datetime_from_bson(d).map(Some)
        }
    }

    deserializer.deserialize_any(OptDateTimeVisitor)
}
