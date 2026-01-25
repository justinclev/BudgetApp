import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Debt } from '../models/debt.model';

@Injectable({
  providedIn: 'root'
})
export class DebtService {
  private apiUrl = 'http://localhost:3000/api/debts';

  constructor(private http: HttpClient) { }

  getDebts(): Observable<Debt[]> {
    return this.http.get<Debt[]>(this.apiUrl);
  }

  createDebt(debt: Debt): Observable<Debt> {
    return this.http.post<Debt>(this.apiUrl, debt);
  }

  updateDebt(id: string, debt: Debt): Observable<Debt> {
    return this.http.put<Debt>(`${this.apiUrl}/${id}`, debt);
  }

  deleteDebt(id: string): Observable<void> {
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