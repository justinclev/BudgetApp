import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UserList,
  CreateListRequest,
  AddItemRequest,
  UpdateItemRequest,
  UpdateListRequest,
  JoinListRequest,
  TodoOccurrence,
} from '../models/list.model';

@Injectable({ providedIn: 'root' })
export class ListService {
  private base = `${environment.apiUrl}/lists`;
  private occBase = `${environment.apiUrl}/todo-occurrences`;

  constructor(private http: HttpClient) {}

  getLists(userId: string): Observable<UserList[]> {
    const params = new HttpParams().set('user_id', userId);
    return this.http.get<UserList[]>(this.base, { params });
  }

  createList(req: CreateListRequest): Observable<UserList> {
    return this.http.post<UserList>(this.base, req);
  }

  getList(id: string): Observable<UserList> {
    return this.http.get<UserList>(`${this.base}/${id}`);
  }

  updateList(id: string, req: UpdateListRequest): Observable<UserList> {
    return this.http.put<UserList>(`${this.base}/${id}`, req);
  }

  deleteList(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addItem(listId: string, req: AddItemRequest): Observable<UserList> {
    return this.http.post<UserList>(`${this.base}/${listId}/items`, req);
  }

  deleteItem(listId: string, itemId: string): Observable<UserList> {
    return this.http.delete<UserList>(`${this.base}/${listId}/items/${itemId}`);
  }

  reorderItems(listId: string, itemIds: string[]): Observable<UserList> {
    return this.http.post<UserList>(`${this.base}/${listId}/items/reorder`, { itemIds });
  }

  removeMember(listId: string, userId: string): Observable<UserList> {
    return this.http.delete<UserList>(
      `${this.base}/${listId}/members/${encodeURIComponent(userId)}`,
    );
  }

  updateItemText(listId: string, itemId: string, text: string): Observable<UserList> {
    return this.http.patch<UserList>(`${this.base}/${listId}/items/${itemId}`, { text });
  }

  addSubItem(listId: string, itemId: string, req: AddItemRequest): Observable<UserList> {
    return this.http.post<UserList>(`${this.base}/${listId}/items/${itemId}/subitems`, req);
  }

  updateSubItemText(
    listId: string,
    itemId: string,
    subId: string,
    text: string,
  ): Observable<UserList> {
    return this.http.patch<UserList>(`${this.base}/${listId}/items/${itemId}/subitems/${subId}`, {
      text,
    });
  }

  deleteSubItem(listId: string, itemId: string, subId: string): Observable<UserList> {
    return this.http.delete<UserList>(`${this.base}/${listId}/items/${itemId}/subitems/${subId}`);
  }

  toggleSubItem(listId: string, itemId: string, subId: string): Observable<UserList> {
    return this.http.patch<UserList>(
      `${this.base}/${listId}/items/${itemId}/subitems/${subId}/toggle`,
      {},
    );
  }

  toggleItem(listId: string, itemId: string, userId?: string): Observable<UserList> {
    return this.http.patch<UserList>(`${this.base}/${listId}/items/${itemId}/toggle`, { userId });
  }

  completeOccurrence(
    listId: string,
    itemId: string,
    date: string,
    userId?: string,
  ): Observable<UserList> {
    return this.http.patch<UserList>(
      `${this.base}/${listId}/items/${itemId}/complete-occurrence`,
      { date, userId },
    );
  }

  resetList(id: string): Observable<UserList> {
    return this.http.post<UserList>(`${this.base}/${id}/reset`, {});
  }

  cloneList(id: string, ownerId: string): Observable<UserList> {
    return this.http.post<UserList>(`${this.base}/${id}/clone`, { ownerId });
  }

  getListByShareToken(token: string): Observable<UserList> {
    return this.http.get<UserList>(`${this.base}/share/${token}`);
  }

  joinListByShareToken(token: string, req: JoinListRequest): Observable<UserList> {
    return this.http.post<UserList>(`${this.base}/share/${token}/join`, req);
  }

  // ── Todo Occurrence API ───────────────────────────────────────────────────

  generateOccurrences(
    userId: string,
    startDate: string,
    endDate: string,
  ): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(`${this.occBase}/generate`, {
      userId,
      startDate,
      endDate,
    });
  }

  getOccurrences(
    userId: string,
    startDate: string,
    endDate: string,
  ): Observable<TodoOccurrence[]> {
    const params = new HttpParams()
      .set('user_id', userId)
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get<TodoOccurrence[]>(this.occBase, { params });
  }

  toggleOccurrence(occurrenceId: string, userId?: string): Observable<TodoOccurrence> {
    return this.http.patch<TodoOccurrence>(`${this.occBase}/${occurrenceId}/toggle`, { userId });
  }
}
