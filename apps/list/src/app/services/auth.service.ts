import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const COOKIE_NAME = 'budget_auth';

function readAuthCookie(): AuthUser | null {
  const match = document.cookie.match(/(?:^|;\s*)budget_auth=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as AuthUser;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthUser | null>(readAuthCookie());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor(private router: Router) {}

  // Called only by the fallback list login (never normally reached).
  login(user: AuthUser): void {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(user))}; path=/; SameSite=Lax`;
    this._user.set(user);
  }

  logout(): void {
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    this._user.set(null);
    // Send to dashboard /logout so the dashboard session is also cleared.
    const base = environment.dashboardUrl;
    window.location.href = `${base}/logout`;
  }

  getUser(): AuthUser | null {
    return this._user();
  }

  // Refresh signal from cookie (call after navigation if needed).
  refresh(): void {
    this._user.set(readAuthCookie());
  }
}
