import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-container">
      <div class="top-bar">
        <h1 style="margin: 0; flex: 1;">My Apps</h1>
        <button (click)="logout()" class="logout-btn">Logout</button>
      </div>

      <div class="header">
        <p class="subtitle">Select an app to get started</p>
      </div>

      <div class="apps-grid">
        <a *ngFor="let app of apps" [routerLink]="app.path" class="app-card">
          <div class="app-icon">{{ app.icon }}</div>
          <h2>{{ app.name }}</h2>
          <p>{{ app.description }}</p>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    .top-bar {
      display: flex;
      align-items: center;
      padding: 1.5rem 2rem;
      background: rgba(0, 0, 0, 0.1);
      color: white;
    }

    .logout-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .logout-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .header {
      text-align: center;
      padding: 2rem;
      color: white;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .header .subtitle {
      font-size: 1.25rem;
      margin: 0;
      opacity: 0.9;
    }

    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      width: 100%;
      max-width: 1000px;
      margin: 0 auto 2rem;
      padding: 0 2rem;
    }

    .app-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      cursor: pointer;
    }

    .app-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
    }

    .app-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .app-card h2 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      color: #333;
    }

    .app-card p {
      margin: 0;
      color: #666;
      font-size: 1rem;
    }

    @media (max-width: 768px) {
      .top-bar {
        padding: 1rem;
      }

      .header {
        padding: 1rem;
      }

      .header .subtitle {
        font-size: 1rem;
      }

      .apps-grid {
        grid-template-columns: 1fr;
        padding: 0 1rem;
      }
    }
  `]
})
export class HomeComponent {
  constructor(private authService: AuthService) {}

  apps = [
    {
      name: 'Budget App',
      description: 'Manage your debts and recurring transactions',
      path: '/budget',
      icon: '💰'
    }
  ];

  logout(): void {
    this.authService.logout();
  }
}
