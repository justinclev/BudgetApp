import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

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

        <button (click)="loginWithGoogle()" class="google-btn">Login with Google</button>
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
        margin: 0 0 2rem 0;
        color: #718096;
        line-height: 1.5;
        font-size: 1rem;
      }

      .google-btn {
        width: 100%;
        height: 54px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .google-btn:hover {
        background: #5a6ed6;
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(102, 126, 234, 0.4);
      }

      .google-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
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
export class LoginComponent {
  constructor(private authService: AuthService) {}

  loginWithGoogle(): void {
    // TODO: Implement actual Google Login logic
    console.log('Logging in with Google...');
    // For now, just set a mock user
    const mockUser = {
      id: '123',
      email: 'user@example.com',
      name: 'Test User',
    };
    this.authService.login(mockUser);
  }
}
