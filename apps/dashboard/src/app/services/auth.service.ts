import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

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

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {}

  loginWithGoogle(credential: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/api/auth/google`, { credential });
  }

  login(userData: any, returnUrl?: string): void {
    // Normalize _id → id so all apps can use user.id consistently
    const normalized = { ...userData, id: userData.id ?? userData._id };
    writeAuthCookie(normalized);
    this.isAuthenticatedSignal.set(true);
    if (returnUrl) {
      window.location.href = decodeURIComponent(returnUrl);
    } else {
      window.location.href = '/';
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
