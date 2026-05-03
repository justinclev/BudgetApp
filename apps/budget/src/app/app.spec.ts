import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './services/auth.service';
import { DebtService } from './services/debt.service';

const COOKIE_NAME = 'budget_auth';

function setAuthCookie(payload: object): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; path=/`;
}
function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ── AuthService ────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    clearAuthCookie();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  afterEach(() => clearAuthCookie());

  it('returns null when no cookie is set', () => {
    expect(service.getUser()).toBeNull();
  });

  it('reads the user from an existing cookie', () => {
    setAuthCookie({ id: 'abc123', email: 'u@example.com', name: 'Test', token: 'tok' });
    service = TestBed.inject(AuthService);
    const user = service.getUser();
    expect(user?.id).toBe('abc123');
    expect(user?.email).toBe('u@example.com');
  });

  it('exposes the JWT token via getToken()', () => {
    setAuthCookie({ id: 'abc123', email: 'u@test.com', name: 'U', token: 'my-jwt' });
    service = TestBed.inject(AuthService);
    expect(service.getToken()).toBe('my-jwt');
  });

  it('normalises legacy _id field to id', () => {
    setAuthCookie({ _id: 'legacy-id', email: 'x@x.com', name: 'X', token: 'tok' });
    service = TestBed.inject(AuthService);
    expect(service.getUser()?.id).toBe('legacy-id');
  });

  it('returns null token when cookie is absent', () => {
    expect(service.getToken()).toBeNull();
  });
});

// ── DebtService ────────────────────────────────────────────────────────────

describe('DebtService', () => {
  let service: DebtService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DebtService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('calls GET /api/debts', () => {
    service.getDebts().subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/debts'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('calls POST /api/debts with the debt payload', () => {
    const debt = { name: 'Car Loan', amountOwed: 5000, interestRate: 3.5 } as any;
    service.createDebt(debt).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/debts'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(debt);
    req.flush(debt);
  });

  it('calls DELETE /api/debts/:id', () => {
    service.deleteDebt('some-id').subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/debts/some-id'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('encodes the name in checkNameExists', () => {
    service.checkNameExists('my debt').subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('check-name'));
    expect(req.request.url).toContain('my%20debt');
    req.flush({ exists: false });
  });
});

