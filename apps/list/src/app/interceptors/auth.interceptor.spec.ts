import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpHandlerFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const COOKIE_NAME = 'budget_auth';
function setAuthCookie(payload: object): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; path=/`;
}
function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

describe('authInterceptor (list app)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAuthCookie();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    clearAuthCookie();
    httpMock.verify();
  });

  it('does NOT add Authorization header when no token', () => {
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('adds Authorization: Bearer <token> header when token present', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'my-jwt' });
    const svc = TestBed.inject(AuthService);
    svc.refresh();

    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt');
    req.flush({});
  });

  it('passes through request body unchanged', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'tok' });
    const svc = TestBed.inject(AuthService);
    svc.refresh();

    const body = { data: 'value' };
    http.post('/api/items', body).subscribe();
    const req = httpMock.expectOne('/api/items');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});
