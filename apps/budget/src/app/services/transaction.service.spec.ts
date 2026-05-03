import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TransactionService } from './transaction.service';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/transactions`;

describe('TransactionService', () => {
  let svc: TransactionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(TransactionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => expect(svc).toBeTruthy());

  it('getTransactions — GET /transactions', () => {
    svc.getTransactions().subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getTransactions — emits array returned by server', () => {
    const mockData = [{ _id: 't1', amount: 500 }] as any;
    let result: any;
    svc.getTransactions().subscribe((r) => (result = r));
    http.expectOne(API).flush(mockData);
    expect(result).toEqual(mockData);
  });

  it('saveTransactions — POST /transactions with array body', () => {
    const payload = [{ _id: 't1', amount: 500 }] as any;
    svc.saveTransactions(payload).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ saved: 1 });
  });

  it('saveTransactions — works with empty array', () => {
    svc.saveTransactions([]).subscribe();
    const req = http.expectOne(API);
    expect(req.request.body).toEqual([]);
    req.flush({ saved: 0 });
  });
});
