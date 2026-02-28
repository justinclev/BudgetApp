import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container flex-center" style="height: 100vh;">
      <div class="modern-card" style="max-width: 400px; width: 100%; text-align: center;">
        <h2>Welcome to Budget Apps</h2>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">
          Sign in to access your apps and manage your finances.
        </p>
        
        <button 
          (click)="loginWithGoogle()"
          style="width: 100%; height: 48px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.3s;">
          Login with Google
        </button>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .flex-center {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modern-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    h2 {
      margin: 0 0 1rem 0;
      color: #333;
    }

    p {
      margin: 0 0 2rem 0;
    }

    button:hover {
      background: #5568d3 !important;
    }
  `]
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
      name: 'Test User'
    };
    this.authService.login(mockUser);
  }
}
