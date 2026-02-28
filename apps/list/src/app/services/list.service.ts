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
} from '../models/list.model';

@Injectable({ providedIn: 'root' })
export class ListService {
  private base = `${environment.apiUrl}/lists`;

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

  toggleItem(listId: string, itemId: string): Observable<UserList> {
    return this.http.patch<UserList>(`${this.base}/${listId}/items/${itemId}/toggle`, {});
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
}
