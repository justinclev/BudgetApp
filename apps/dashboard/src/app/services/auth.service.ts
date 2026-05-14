import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

const COOKIE_NAME = 'budget_auth';

interface AuthCookiePayload {
  id: string;
  email: string;
  name: string;
  token: string;
}

function readAuthCookie(): AuthCookiePayload | null {
  const match = document.cookie.match(/(?:^|;\s*)budget_auth=([^;]+)/);
  if (!match) return null;
  try {
    const raw = JSON.parse(decodeURIComponent(match[1]));
    return { ...raw, id: raw.id ?? raw._id } as AuthCookiePayload;
  } catch {
    return null;
  }
}

function writeAuthCookie(payload: AuthCookiePayload): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; path=/; SameSite=Lax`;
}

function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isAuthenticatedSignal = signal<boolean>(!!readAuthCookie());
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {}

  loginWithGoogle(credential: string): Observable<{ token: string; user: any }> {
    return this.http.post<{ token: string; user: any }>(`${environment.apiUrl}/auth/google`, {
      credential,
    });
  }

  loginWithDevAccount(userId: string): Observable<{ token: string; user: any }> {
    return this.http.post<{ token: string; user: any }>(
      `${environment.apiUrl}/auth/dev-login`,
      { user_id: userId },
    );
  }

  /** Stores the JWT + user profile in the shared cookie and navigates. */
  login(authResponse: { token: string; user: any }, returnUrl?: string): void {
    const user = authResponse.user;
    const payload = {
      id: user.id ?? user._id,
      email: user.email,
      name: user.name,
      token: authResponse.token,
    };
    writeAuthCookie(payload);
    this.isAuthenticatedSignal.set(true);
    if (returnUrl) {
      window.location.href = decodeURIComponent(returnUrl);
    } else {
      window.location.href = '/';
    }
  }

  getToken(): string | null {
    return readAuthCookie()?.token ?? null;
  }

  logout(): void {
    clearAuthCookie();
    this.isAuthenticatedSignal.set(false);
    this.router.navigate(['/login']);
  }

  getUser(): AuthCookiePayload | null {
    return readAuthCookie();
  }
}
