import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSignal = signal<boolean>(this.loadAuthState());

  isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  constructor(private router: Router) {}

  private loadAuthState(): boolean {
    // Check if user is authenticated from localStorage
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('user');
  }

  login(userData: any): void {
    // Store user data in localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    this.isAuthenticatedSignal.set(true);
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    localStorage.removeItem('user');
    this.isAuthenticatedSignal.set(false);
    this.router.navigate(['/']);
  }

  getUser(): any {
    if (typeof localStorage === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
}
