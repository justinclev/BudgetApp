import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

type State = 'loading' | 'success' | 'not-logged-in' | 'error';

@Component({
  selector: 'app-voice-link',
  standalone: true,
  imports: [],
  templateUrl: './voice-link.component.html',
  styleUrl: './voice-link.component.scss',
})
export class VoiceLinkComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  state = signal<State>('loading');
  platform = signal<'alexa' | 'google' | 'unknown'>('unknown');
  errorMsg = signal('');

  private apiBase = environment.production
    ? environment.apiUrl
    : 'https://budgetapp-ma3x.onrender.com/api';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const clientId = params.get('client_id') ?? '';
    const redirectUri = params.get('redirect_uri') ?? '';
    const state = params.get('state') ?? '';

    // Detect which platform is linking
    if (clientId.toLowerCase().includes('amazon') || redirectUri.includes('amazon')) {
      this.platform.set('alexa');
    } else if (clientId.toLowerCase().includes('google') || redirectUri.includes('google')) {
      this.platform.set('google');
    }

    const user = this.auth.user();
    if (!user) {
      this.state.set('not-logged-in');
      return;
    }

    if (!redirectUri || !state) {
      this.state.set('error');
      this.errorMsg.set('Missing required OAuth parameters (redirect_uri or state).');
      return;
    }

    // User is already logged in — auto-complete the link
    this.http
      .post<{ redirect_url: string }>(`${this.apiBase}/voice/oauth/code`, {
        user_id: user.id,
        redirect_uri: redirectUri,
        state,
        client_id: clientId,
      })
      .subscribe({
        next: (res) => {
          this.state.set('success');
          setTimeout(() => {
            window.location.href = res.redirect_url;
          }, 1200);
        },
        error: (err) => {
          this.state.set('error');
          this.errorMsg.set(err?.error?.error ?? 'Something went wrong. Please try again.');
        },
      });
  }

  openApp(): void {
    window.location.href = '/';
  }

  platformName(): string {
    const p = this.platform();
    if (p === 'alexa') return 'Amazon Alexa';
    if (p === 'google') return 'Google Home';
    return 'your voice assistant';
  }

  platformIcon(): string {
    const p = this.platform();
    if (p === 'alexa') return '🔵';
    if (p === 'google') return '🟡';
    return '🎙️';
  }
}
