import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

const COOKIE_NAME = 'budget_auth';

function readAuthCookie(): any | null {
  const match = document.cookie.match(/(?:^|;\s*)budget_auth=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function writeAuthCookie(user: any): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(user))}; path=/; SameSite=Lax`;
}

function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isAuthenticatedSignal = signal<boolean>(!!readAuthCookie());
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  constructor(private router: Router) {}

  login(userData: any, returnUrl?: string): void {
    writeAuthCookie(userData);
    this.isAuthenticatedSignal.set(true);
    if (returnUrl) {
      window.location.href = decodeURIComponent(returnUrl);
    } else {
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    clearAuthCookie();
    this.isAuthenticatedSignal.set(false);
    this.router.navigate(['/login']);
  }

  getUser(): any {
    return readAuthCookie();
  }
}
