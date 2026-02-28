import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container flex-center">
      <div class="modern-card">
        <div class="icon-circle">🔐</div>
        <h2>Welcome to Budget Apps</h2>
        <p>Sign in to access your apps and manage your finances.</p>

        <!-- Google Sign-In -->
        <div id="google-btn" class="google-btn-wrap"></div>

        <div class="divider"><span>or</span></div>

        <!-- Dev test accounts -->
        <p class="dev-label">Dev accounts</p>
        <button (click)="loginAs(0)" class="account-btn">
          <span class="acct-avatar acct-avatar--alice">A</span>
          Sign in as Alice
        </button>
        <button (click)="loginAs(1)" class="account-btn">
          <span class="acct-avatar acct-avatar--bob">B</span>
          Sign in as Bob
        </button>

        <p *ngIf="googleError" class="error-msg">{{ googleError }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 1rem;
      }

      .modern-card {
        background: white;
        border-radius: 20px;
        padding: 2.5rem 2rem;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        width: 100%;
        text-align: center;
      }

      .icon-circle {
        font-size: 3rem;
        background: rgba(102, 126, 234, 0.1);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
      }

      h2 {
        margin: 0 0 0.5rem 0;
        color: #2d3748;
        font-size: 1.75rem;
        font-weight: 700;
      }

      p {
        margin: 0 0 0.75rem 0;
        color: #718096;
        line-height: 1.5;
        font-size: 1rem;
      }

      .google-btn-wrap {
        display: flex;
        justify-content: center;
        margin: 0.5rem 0 0;
        min-height: 44px;
      }

      .divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 1.25rem 0 0.75rem;
        color: #cbd5e0;
        font-size: 13px;
      }

      .divider::before,
      .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }

      .divider span {
        color: #a0aec0;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .dev-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
        margin: 0 0 0.75rem;
      }

      .account-btn {
        width: 100%;
        height: 52px;
        display: flex;
        align-items: center;
        gap: 12px;
        background: #f8fafc;
        color: #0f172a;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 10px;
        padding: 0 16px;
        transition:
          background 0.15s,
          border-color 0.15s;
      }

      .account-btn:hover {
        background: #f1f5f9;
        border-color: #c7d2fe;
      }

      .account-btn:last-of-type {
        margin-bottom: 0;
      }

      .acct-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        color: white;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .acct-avatar--alice {
        background: linear-gradient(135deg, #667eea, #764ba2);
      }
      .acct-avatar--bob {
        background: linear-gradient(135deg, #f59e0b, #ef4444);
      }

      .error-msg {
        margin-top: 1rem;
        color: #e53e3e;
        font-size: 0.875rem;
      }

      @media (max-width: 480px) {
        .modern-card {
          padding: 2rem 1.5rem;
          border-radius: 16px;
        }

        h2 {
          font-size: 1.5rem;
        }

        .icon-circle {
          width: 70px;
          height: 70px;
          font-size: 2.5rem;
        }
      }
    `,
  ],
})
export class LoginComponent implements AfterViewInit {
  googleError: string | null = null;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  private readonly mockUsers = [
    { id: '507f1f77bcf86cd799439011', email: 'alice@example.com', name: 'Alice' },
    { id: '507f1f77bcf86cd799439012', email: 'bob@example.com', name: 'Bob' },
  ];

  ngAfterViewInit(): void {
    if (typeof google !== 'undefined' && environment.googleClientId !== 'YOUR_GOOGLE_CLIENT_ID') {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.handleGoogleCredential(response),
      });
      google.accounts.id.renderButton(document.getElementById('google-btn'), {
        theme: 'outline',
        size: 'large',
        width: 368,
        text: 'signin_with',
      });
    }
  }

  handleGoogleCredential(response: any): void {
    this.googleError = null;
    this.authService.loginWithGoogle(response.credential).subscribe({
      next: (user: any) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.authService.login(user, returnUrl ?? undefined);
      },
      error: () => {
        this.googleError = 'Google sign-in failed. Please try again.';
      },
    });
  }

  loginAs(index: number): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.authService.login(this.mockUsers[index], returnUrl ?? undefined);
  }
}
