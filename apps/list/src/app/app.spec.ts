import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

const COOKIE_NAME = 'budget_auth';

function setAuthCookie(payload: object): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; path=/`;
}
function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ── AuthService (list app) ─────────────────────────────────────────────────

describe('AuthService (list app)', () => {
  let service: AuthService;

  beforeEach(() => {
    clearAuthCookie();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => clearAuthCookie());

  it('isAuthenticated is false when no cookie exists', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('isAuthenticated is true when a valid cookie exists', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'U', token: 't' });
    service.refresh();
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('exposes the logged-in user', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'Alice', token: 'jwt-xyz' });
    service.refresh();
    expect(service.getUser()?.name).toBe('Alice');
  });

  it('exposes the JWT token via getToken()', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'Alice', token: 'jwt-xyz' });
    service.refresh();
    expect(service.getToken()).toBe('jwt-xyz');
  });

  it('becomes unauthenticated after cookie is cleared and refresh() is called', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'U', token: 't' });
    service.refresh();
    expect(service.isAuthenticated()).toBeTrue();
    clearAuthCookie();
    service.refresh();
    expect(service.isAuthenticated()).toBeFalse();
  });
});

