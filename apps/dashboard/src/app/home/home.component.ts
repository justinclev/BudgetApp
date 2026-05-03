import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="top-bar">
        <span class="app-title">⊞ My Apps</span>
        <div class="header-actions">
          <span *ngIf="userName" class="user-name">{{ userName }}</span>
          <button (click)="logout()" class="icon-btn" title="Logout">⏻</button>
        </div>
      </div>

      <div class="header">
        <p class="subtitle">Select an app to get started</p>
      </div>

      <div class="apps-grid">
        <a *ngFor="let app of apps" [href]="app.path" target="_self" class="app-card">
          <div class="app-icon">{{ app.icon }}</div>
          <div class="app-card-content">
            <h2>{{ app.name }}</h2>
            <p>{{ app.description }}</p>
          </div>
        </a>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 0;
        display: flex;
        flex-direction: column;
      }

      .top-bar {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .app-title {
        font-size: 18px;
        font-weight: 700;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .user-name {
        font-size: 13px;
        opacity: 0.85;
      }

      .icon-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .icon-btn:hover {
        background: rgba(255, 255, 255, 0.3);
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
        border-radius: 16px;
        padding: 1.5rem;
        text-decoration: none;
        color: inherit;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        -webkit-tap-highlight-color: transparent;
      }

      .app-card:active {
        transform: scale(0.98);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      @media (hover: hover) {
        .app-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
        }
      }

      .app-icon {
        font-size: 3.5rem;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(102, 126, 234, 0.1);
        width: 80px;
        height: 80px;
        border-radius: 20px;
      }

      .app-card h2 {
        font-size: 1.25rem;
        margin: 0 0 0.5rem 0;
        color: #2d3748;
        font-weight: 600;
      }

      .app-card p {
        margin: 0;
        color: #718096;
        font-size: 0.9rem;
        line-height: 1.4;
      }

      @media (max-width: 600px) {
        .top-bar {
          padding: 12px 16px;
        }

        .app-title {
          font-size: 16px;
        }

        .header {
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .header .subtitle {
          font-size: 1rem;
        }

        .apps-grid {
          grid-template-columns: 1fr;
          gap: 1.25rem;
          padding: 0 1.25rem;
          margin-bottom: 2rem;
        }

        .app-card {
          flex-direction: row;
          text-align: left;
          padding: 1.25rem;
        }

        .app-icon {
          font-size: 2.5rem;
          width: 60px;
          height: 60px;
          margin-bottom: 0;
          margin-right: 1.25rem;
          flex-shrink: 0;
        }

        .app-card-content {
          flex: 1;
        }

        .app-card h2 {
          font-size: 1.1rem;
          margin-bottom: 0.25rem;
        }
      }
    `,
  ],
})
export class HomeComponent {
  constructor(private authService: AuthService) {}

  get userName(): string {
    return this.authService.getUser()?.name ?? '';
  }

  apps = [
    {
      name: 'Budget App',
      description: 'Manage your debts and recurring transactions',
      path: environment.budgetUrl,
      icon: '💰',
    },
    {
      name: 'List App',
      description: 'Grocery lists, chores, to-dos and more',
      path: environment.listUrl,
      icon: '📋',
    },
  ];

  logout(): void {
    this.authService.logout();
  }
}
