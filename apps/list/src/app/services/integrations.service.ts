import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GenerateKeyResponse {
  api_key: string;
}

@Injectable({ providedIn: 'root' })
export class IntegrationsService {
  private base = `${environment.apiUrl}/integrations`;

  constructor(private http: HttpClient) {}

  /**
   * Calls `POST /api/integrations/generate-key?user_id=<id>`.
   * Returns the newly generated 64-char webhook API key.
   */
  generateWebhookKey(userId: string): Observable<GenerateKeyResponse> {
    const params = new HttpParams().set('user_id', userId);
    return this.http.post<GenerateKeyResponse>(
      `${this.base}/generate-key`,
      {},
      { params }
    );
  }
}
