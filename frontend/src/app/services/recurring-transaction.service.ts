import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RecurringTransactionService {
  private apiUrl = `${environment.apiUrl}/recurring-transactions`;

  constructor(private http: HttpClient) {}

  getTransactions(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(this.apiUrl);
  }

  createTransaction(transaction: RecurringTransaction): Observable<RecurringTransaction> {
    return this.http.post<RecurringTransaction>(this.apiUrl, transaction);
  }

  updateTransaction(
    id: string,
    transaction: RecurringTransaction,
  ): Observable<RecurringTransaction> {
    return this.http.put<RecurringTransaction>(`${this.apiUrl}/${id}`, transaction);
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  checkNameExists(name: string, excludeId?: string): Observable<{ exists: boolean }> {
    let url = `${this.apiUrl}/check-name/${encodeURIComponent(name)}`;
    if (excludeId) {
      url += `?excludeId=${excludeId}`;
    }
    return this.http.get<{ exists: boolean }>(url);
  }
}
