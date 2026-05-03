import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RecurringTransactionService } from './recurring-transaction.service';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/recurring-transactions`;

describe('RecurringTransactionService', () => {
  let svc: RecurringTransactionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(RecurringTransactionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => expect(svc).toBeTruthy());

  it('getTransactions — GET /recurring-transactions', () => {
    svc.getTransactions().subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('createTransaction — POST /recurring-transactions', () => {
    const payload = { name: 'Rent', amount: 1000 } as any;
    svc.createTransaction(payload).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(payload);
  });

  it('updateTransaction — PUT /recurring-transactions/:id', () => {
    const payload = { name: 'Rent Updated', amount: 1100 } as any;
    svc.updateTransaction('rt1', payload).subscribe();
    const req = http.expectOne(`${API}/rt1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(payload);
  });

  it('deleteTransaction — DELETE /recurring-transactions/:id', () => {
    svc.deleteTransaction('rt1').subscribe();
    const req = http.expectOne(`${API}/rt1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('checkNameExists — GET /recurring-transactions/check-name/:name (URL encoded)', () => {
    svc.checkNameExists('My Rent').subscribe();
    const req = http.expectOne(`${API}/check-name/My%20Rent`);
    expect(req.request.method).toBe('GET');
    req.flush({ exists: false });
  });

  it('checkNameExists — appends excludeId query param when provided', () => {
    svc.checkNameExists('Rent', 'exclude-id-123').subscribe();
    const req = http.expectOne(`${API}/check-name/Rent?excludeId=exclude-id-123`);
    expect(req.request.method).toBe('GET');
    req.flush({ exists: false });
  });

  it('checkNameExists — returns exists:true when name is taken', () => {
    let result: { exists: boolean } | undefined;
    svc.checkNameExists('Existing').subscribe((r) => (result = r));
    http.expectOne(`${API}/check-name/Existing`).flush({ exists: true });
    expect(result?.exists).toBeTrue();
  });
});
