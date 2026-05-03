import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';

const COOKIE_NAME = 'budget_auth';
function setAuthCookie(payload: object): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; path=/`;
}
function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

describe('authInterceptor (budget app)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAuthCookie();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    clearAuthCookie();
    httpMock.verify();
  });

  it('does NOT add Authorization header when no auth cookie', () => {
    http.get('/api/debts').subscribe();
    const req = httpMock.expectOne('/api/debts');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });

  it('adds Authorization: Bearer <token> when token in cookie', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'jwt-token-123' });
    http.get('/api/debts').subscribe();
    const req = httpMock.expectOne('/api/debts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    req.flush([]);
  });

  it('does not modify URL or method', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'tok' });
    http.delete('/api/debts/d1').subscribe();
    const req = httpMock.expectOne('/api/debts/d1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.url).toBe('/api/debts/d1');
    req.flush(null);
  });

  it('works with POST requests and preserves body', () => {
    setAuthCookie({ id: 'u1', email: 'u@x.com', name: 'User', token: 'tok' });
    const body = { name: 'Car Loan', amount: 5000 };
    http.post('/api/debts', body).subscribe();
    const req = httpMock.expectOne('/api/debts');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush({});
  });
});
