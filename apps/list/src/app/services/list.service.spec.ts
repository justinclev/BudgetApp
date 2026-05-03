import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ListService } from './list.service';
import { environment } from '../../environments/environment';

const BASE = `${environment.apiUrl}/lists`;
const OCC_BASE = `${environment.apiUrl}/todo-occurrences`;

describe('ListService', () => {
  let svc: ListService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    svc = TestBed.inject(ListService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => expect(svc).toBeTruthy());

  // ── Core CRUD ─────────────────────────────────────────────────────────

  it('getLists — GET /lists?user_id=u1', () => {
    svc.getLists('u1').subscribe();
    const req = http.expectOne(`${BASE}?user_id=u1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('createList — POST /lists', () => {
    const body = { name: 'Shopping' } as any;
    svc.createList(body).subscribe();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('getList — GET /lists/:id', () => {
    svc.getList('list1').subscribe();
    const req = http.expectOne(`${BASE}/list1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updateList — PUT /lists/:id', () => {
    const body = { name: 'Updated' } as any;
    svc.updateList('list1', body).subscribe();
    const req = http.expectOne(`${BASE}/list1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteList — DELETE /lists/:id', () => {
    svc.deleteList('list1').subscribe();
    const req = http.expectOne(`${BASE}/list1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ── Items ────────────────────────────────────────────────────────────

  it('addItem — POST /lists/:id/items', () => {
    svc.addItem('list1', { text: 'milk' } as any).subscribe();
    const req = http.expectOne(`${BASE}/list1/items`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteItem — DELETE /lists/:id/items/:itemId', () => {
    svc.deleteItem('list1', 'item1').subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('reorderItems — POST /lists/:id/items/reorder', () => {
    svc.reorderItems('list1', ['a', 'b']).subscribe();
    const req = http.expectOne(`${BASE}/list1/items/reorder`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ itemIds: ['a', 'b'] });
    req.flush({});
  });

  it('updateItemText — PATCH /lists/:id/items/:itemId', () => {
    svc.updateItemText('list1', 'item1', 'eggs').subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ text: 'eggs' });
    req.flush({});
  });

  it('toggleItem — PATCH /lists/:id/items/:itemId/toggle', () => {
    svc.toggleItem('list1', 'item1', 'u1').subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1/toggle`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('completeOccurrence — PATCH /lists/:id/items/:itemId/complete-occurrence', () => {
    svc.completeOccurrence('list1', 'item1', '2024-01-15', 'u1').subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1/complete-occurrence`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ date: '2024-01-15', userId: 'u1' });
    req.flush({});
  });

  // ── Sub-items ────────────────────────────────────────────────────────

  it('addSubItem — POST /lists/:id/items/:itemId/subitems', () => {
    svc.addSubItem('list1', 'item1', { text: 'sub' } as any).subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1/subitems`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteSubItem — DELETE /lists/:id/items/:itemId/subitems/:subId', () => {
    svc.deleteSubItem('list1', 'item1', 'sub1').subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1/subitems/sub1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('toggleSubItem without userId — no query param', () => {
    svc.toggleSubItem('list1', 'item1', 'sub1').subscribe();
    const req = http.expectOne(`${BASE}/list1/items/item1/subitems/sub1/toggle`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('toggleSubItem with userId — encodes user_id in query param', () => {
    svc.toggleSubItem('list1', 'item1', 'sub1', 'user@test.com').subscribe();
    const req = http.expectOne(
      `${BASE}/list1/items/item1/subitems/sub1/toggle?user_id=user%40test.com`,
    );
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  // ── List-level actions ───────────────────────────────────────────────

  it('removeMember — DELETE /lists/:id/members/:userId (URL encoded)', () => {
    svc.removeMember('list1', 'user@example.com').subscribe();
    const req = http.expectOne(`${BASE}/list1/members/user%40example.com`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('resetList — POST /lists/:id/reset', () => {
    svc.resetList('list1').subscribe();
    const req = http.expectOne(`${BASE}/list1/reset`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('cloneList — POST /lists/:id/clone with ownerId', () => {
    svc.cloneList('list1', 'u2').subscribe();
    const req = http.expectOne(`${BASE}/list1/clone`);
    expect(req.request.body.ownerId).toBe('u2');
    req.flush({});
  });

  it('getListByShareToken — GET /lists/share/:token', () => {
    svc.getListByShareToken('tok123').subscribe();
    const req = http.expectOne(`${BASE}/share/tok123`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('joinListByShareToken — POST /lists/share/:token/join', () => {
    svc.joinListByShareToken('tok123', { userId: 'u1' } as any).subscribe();
    const req = http.expectOne(`${BASE}/share/tok123/join`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  // ── Occurrence API ───────────────────────────────────────────────────

  it('generateOccurrences — POSTs to /todo-occurrences/generate', () => {
    svc.generateOccurrences('u1', '2024-01-01', '2024-01-31').subscribe();
    const req = http.expectOne(`${OCC_BASE}/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      userId: 'u1',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });
    req.flush({ generated: 5 });
  });

  it('generateOccurrences — returns cached result on second call (no HTTP)', () => {
    // First call: makes HTTP request
    svc.generateOccurrences('u1', '2024-01-01', '2024-01-31').subscribe();
    http.expectOne(`${OCC_BASE}/generate`).flush({ generated: 1 });

    // Second call with same params: returns of({generated:0}), no new HTTP request
    let result: { generated: number } | undefined;
    svc.generateOccurrences('u1', '2024-01-01', '2024-01-31').subscribe((r) => (result = r));
    http.expectNone(`${OCC_BASE}/generate`);
    expect(result).toEqual({ generated: 0 });
  });

  it('generateOccurrences — different params bypass cache', () => {
    svc.generateOccurrences('u1', '2024-01-01', '2024-01-31').subscribe();
    http.expectOne(`${OCC_BASE}/generate`).flush({ generated: 1 });

    svc.generateOccurrences('u1', '2024-02-01', '2024-02-29').subscribe();
    const req2 = http.expectOne(`${OCC_BASE}/generate`);
    expect(req2.request.body.startDate).toBe('2024-02-01');
    req2.flush({ generated: 3 });
  });

  it('getOccurrences — GET /todo-occurrences with query params', () => {
    svc.getOccurrences('u1', '2024-01-01', '2024-01-31').subscribe();
    const req = http.expectOne(
      `${OCC_BASE}?user_id=u1&start_date=2024-01-01&end_date=2024-01-31`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('toggleOccurrence — PATCH /todo-occurrences/:id/toggle', () => {
    svc.toggleOccurrence('occ1', 'u1').subscribe();
    const req = http.expectOne(`${OCC_BASE}/occ1/toggle`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ userId: 'u1' });
    req.flush({});
  });
});
