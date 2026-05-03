import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const COOKIE_NAME = 'budget_auth';

function setAuthCookie(payload: object): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; path=/`;
}
function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

describe('authGuard (dashboard app)', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    clearAuthCookie();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  afterEach(() => {
    clearAuthCookie();
    TestBed.inject(HttpTestingController).verify();
  });

  function runGuard(): boolean {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any)) as boolean;
  }

  it('returns true when user is authenticated (cookie present)', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'tok' });
    expect(runGuard()).toBeTrue();
  });

  it('returns false when user is not authenticated (no cookie)', () => {
    expect(runGuard()).toBeFalse();
  });

  it('calls router.navigate(["/login"]) when not authenticated', () => {
    runGuard();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does NOT call router.navigate when authenticated', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'tok' });
    runGuard();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
