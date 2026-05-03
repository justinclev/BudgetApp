use actix_web::{web, HttpResponse, Responder};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use std::env;

use crate::auth::sign_token;
use crate::db::AppState;
use crate::models::{AuthResponse, DevLoginRequest, GoogleAuthRequest, User};

// ── Google tokeninfo response ─────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
struct GoogleTokenInfo {
    sub: String,
    email: String,
    name: Option<String>,
    picture: Option<String>,
    #[allow(dead_code)]
    email_verified: Option<String>,
}

pub async fn get_users(data: web::Data<AppState>) -> impl Responder {
    let mut cursor = match data.users_collection.find(None, None).await {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let mut users: Vec<User> = Vec::new();
    while let Some(result) = cursor.next().await {
        match result {
            Ok(u) => users.push(u),
            Err(e) => eprintln!("Error deserializing user: {:?}", e),
        }
    }

    users.sort_by(|a, b| a.name.cmp(&b.name));
    HttpResponse::Ok().json(users)
}

pub async fn get_user(data: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id_str = path.into_inner();
    let object_id = match ObjectId::parse_str(&id_str) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid ID format"),
    };

    match data
        .users_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(user)) => HttpResponse::Ok().json(user),
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "message": "User not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

pub async fn create_user(data: web::Data<AppState>, body: web::Json<User>) -> impl Responder {
    let new_user = body.into_inner();
    match data.users_collection.insert_one(new_user, None).await {
        Ok(result) => {
            if let Some(new_id) = result.inserted_id.as_object_id() {
                match data
                    .users_collection
                    .find_one(doc! { "_id": new_id }, None)
                    .await
                {
                    Ok(Some(user)) => HttpResponse::Created().json(user),
                    _ => {
                        HttpResponse::InternalServerError().body("Failed to retrieve created user")
                    }
                }
            } else {
                HttpResponse::InternalServerError().body("Failed to get inserted ID")
            }
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

// ── POST /api/auth/google ─────────────────────────────────────────────────────
// Verifies a Google ID token, then upserts the user (create on first login,
// update lastLogin on subsequent logins).  Returns the user document.
pub async fn google_auth(
    data: web::Data<AppState>,
    body: web::Json<GoogleAuthRequest>,
) -> impl Responder {
    // 1. Verify token via Google's tokeninfo endpoint
    let verify_url = format!(
        "https://oauth2.googleapis.com/tokeninfo?id_token={}",
        &body.credential
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let token_info = match client.get(&verify_url).send().await {
        Ok(resp) if resp.status().is_success() => match resp.json::<GoogleTokenInfo>().await {
            Ok(info) => info,
            Err(e) => {
                return HttpResponse::Unauthorized()
                    .body(format!("Failed to parse token info: {}", e))
            }
        },
        Ok(resp) => {
            let status = resp.status();
            return HttpResponse::Unauthorized()
                .body(format!("Google rejected token (status {})", status));
        }
        Err(e) => {
            return HttpResponse::InternalServerError()
                .body(format!("Failed to reach Google: {}", e))
        }
    };

    // 2. Upsert user: update lastLogin if found, create if new
    let now = chrono::Utc::now();
    let filter = doc! { "email": &token_info.email };

    let update = doc! {
        "$set": {
            "googleId": &token_info.sub,
            "lastLogin": mongodb::bson::DateTime::from_millis(now.timestamp_millis()),
        },
        "$setOnInsert": {
            "name": token_info.name.as_deref().unwrap_or(&token_info.email),
            "avatarUrl": token_info.picture.as_deref().unwrap_or(""),
            "email": &token_info.email,
            "createdAt": mongodb::bson::DateTime::from_millis(now.timestamp_millis()),
        }
    };

    let options = mongodb::options::FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .build();

    match data
        .users_collection
        .find_one_and_update(filter, update, options)
        .await
    {
        Ok(Some(user)) => {
            let user_id = user.id.map(|oid| oid.to_hex()).unwrap_or_default();
            match sign_token(&user_id, &user.email, &data.jwt_secret) {
                Ok(token) => HttpResponse::Ok().json(AuthResponse { token, user }),
                Err(e) => {
                    HttpResponse::InternalServerError().body(format!("Failed to sign token: {}", e))
                }
            }
        }
        Ok(None) => HttpResponse::InternalServerError().body("Upsert returned no document"),
        Err(e) => HttpResponse::InternalServerError().body(format!("DB error: {}", e)),
    }
}

// ── POST /api/auth/dev-login  (DEV_MODE=true only) ────────────────────────
/// Issues a real JWT for a known dev user by ID.  Only available when the
/// DEV_MODE environment variable is set to "true".
pub async fn dev_login(
    data: web::Data<AppState>,
    body: web::Json<DevLoginRequest>,
) -> impl Responder {
    if env::var("DEV_MODE").as_deref() != Ok("true") {
        return HttpResponse::NotFound().body("Not found");
    }

    let object_id = match ObjectId::parse_str(&body.user_id) {
        Ok(oid) => oid,
        Err(_) => return HttpResponse::BadRequest().body("Invalid user_id format"),
    };

    match data
        .users_collection
        .find_one(doc! { "_id": object_id }, None)
        .await
    {
        Ok(Some(user)) => {
            let user_id = user.id.map(|oid| oid.to_hex()).unwrap_or_default();
            match sign_token(&user_id, &user.email, &data.jwt_secret) {
                Ok(token) => HttpResponse::Ok().json(AuthResponse { token, user }),
                Err(e) => {
                    HttpResponse::InternalServerError().body(format!("Failed to sign token: {}", e))
                }
            }
        }
        Ok(None) => HttpResponse::NotFound().body("User not found"),
        Err(e) => HttpResponse::InternalServerError().body(format!("DB error: {}", e)),
    }
}

/// Removed from the route table when DEV_MODE is not "true" via .configure().
/// This function is intentionally unreachable in production; it exists so that
/// any accidental direct reference produces a clear compile-time artefact.
#[allow(dead_code)]
pub async fn dev_login_disabled() -> impl Responder {
    HttpResponse::NotFound().body("Not found")
}
