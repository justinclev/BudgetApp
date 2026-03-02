import { Injectable } from '@angular/core';

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
    const raw = JSON.parse(decodeURIComponent(match[1]));
    // Normalize _id → id for sessions written before the fix
    return { ...raw, id: raw.id ?? raw._id } as AuthUser;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  getUser(): AuthUser | null {
    return readAuthCookie();
  }
}
