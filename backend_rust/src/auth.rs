//! Lightweight HS256 JWT implementation using hmac + sha2 + base64.
//! No RSA/EC — suitable for a symmetric-key server-to-client token workflow.

use actix_web::{web, FromRequest, HttpRequest};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use futures::future::{ready, Ready};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::db::AppState;

/// Number of seconds a token is valid (7 days).
const TOKEN_EXPIRY_SECS: u64 = 7 * 24 * 3600;

/// Fixed base64url-encoded header for HS256 tokens.
const HEADER_B64: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";

// ── Claims ─────────────────────────────────────────────────────────────────

/// Claims embedded in every JWT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// MongoDB user _id as a hex string.
    pub sub: String,
    pub email: String,
    /// Unix timestamp (seconds) at which the token expires.
    pub exp: u64,
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn hmac_sha256(secret: &[u8], msg: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(msg);
    mac.finalize().into_bytes().to_vec()
}

// ── Public API ─────────────────────────────────────────────────────────────

/// Sign a new HS256 JWT for the given user.
pub fn sign_token(user_id: &str, email: &str, secret: &str) -> Result<String, String> {
    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        + TOKEN_EXPIRY_SECS;

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp,
    };
    let payload_b64 = URL_SAFE_NO_PAD.encode(
        serde_json::to_string(&claims)
            .map_err(|e| e.to_string())?
            .as_bytes(),
    );

    let signing_input = format!("{}.{}", HEADER_B64, payload_b64);
    let sig = URL_SAFE_NO_PAD.encode(hmac_sha256(secret.as_bytes(), signing_input.as_bytes()));

    Ok(format!("{}.{}", signing_input, sig))
}

/// Verify a JWT and return its claims.  Returns `Err` for bad signature,
/// malformed token, or expiry.
pub fn verify_token(token: &str, secret: &str) -> Result<Claims, String> {
    let parts: Vec<&str> = token.splitn(3, '.').collect();
    if parts.len() != 3 {
        return Err("Malformed token: expected 3 dot-separated parts".into());
    }

    let signing_input = format!("{}.{}", parts[0], parts[1]);

    let provided_sig = URL_SAFE_NO_PAD
        .decode(parts[2])
        .map_err(|_| "Invalid base64 in signature".to_string())?;

    // Constant-time HMAC-SHA256 comparison via the Mac trait
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("valid key");
    mac.update(signing_input.as_bytes());
    mac.verify_slice(&provided_sig)
        .map_err(|_| "Signature mismatch".to_string())?;

    let payload_json = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| "Invalid base64 in payload".to_string())?;
    let claims: Claims =
        serde_json::from_slice(&payload_json).map_err(|e| format!("Invalid claims JSON: {}", e))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    if claims.exp < now {
        return Err("Token has expired".into());
    }

    Ok(claims)
}

// ── Actix-web extractor ────────────────────────────────────────────────────

/// Wraps verified JWT claims.  Use as a handler parameter to require auth.
///
/// ```rust
/// pub async fn my_handler(auth: AuthenticatedUser, …) -> impl Responder { … }
/// ```
#[allow(dead_code)]
pub struct AuthenticatedUser(pub Claims);

impl FromRequest for AuthenticatedUser {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_web::dev::Payload) -> Self::Future {
        let bearer = req
            .headers()
            .get(actix_web::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "));

        let Some(token) = bearer else {
            return ready(Err(actix_web::error::ErrorUnauthorized(
                "Missing Authorization header",
            )));
        };

        let Some(state) = req.app_data::<web::Data<AppState>>() else {
            return ready(Err(actix_web::error::ErrorInternalServerError(
                "App state unavailable",
            )));
        };

        match verify_token(token, &state.jwt_secret) {
            Ok(claims) => ready(Ok(AuthenticatedUser(claims))),
            Err(msg) => ready(Err(actix_web::error::ErrorUnauthorized(msg))),
        }
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret-that-is-at-least-32-characters-long";

    #[test]
    fn round_trip_valid_token() {
        let token =
            sign_token("user123", "user@example.com", SECRET).expect("sign_token should succeed");
        let claims = verify_token(&token, SECRET).expect("verify_token should succeed");
        assert_eq!(claims.sub, "user123");
        assert_eq!(claims.email, "user@example.com");
    }

    #[test]
    fn rejects_wrong_secret() {
        let token =
            sign_token("user123", "user@example.com", SECRET).expect("sign_token should succeed");
        let result = verify_token(&token, "a-completely-different-secret-here!!!!");
        assert!(
            result.is_err(),
            "Should reject token signed with different secret"
        );
    }

    #[test]
    fn rejects_tampered_token() {
        let token =
            sign_token("user123", "user@example.com", SECRET).expect("sign_token should succeed");
        // Flip a character in the payload segment
        let parts: Vec<&str> = token.splitn(3, '.').collect();
        let mut modified = parts[1].to_string();
        let last = modified.pop().unwrap_or('a');
        let replacement = if last == 'a' { 'b' } else { 'a' };
        modified.push(replacement);
        let tampered = format!("{}.{}.{}", parts[0], modified, parts[2]);
        assert!(verify_token(&tampered, SECRET).is_err());
    }

    #[test]
    fn token_contains_three_parts() {
        let token = sign_token("u", "u@u.com", SECRET).unwrap();
        assert_eq!(token.split('.').count(), 3);
    }
}
