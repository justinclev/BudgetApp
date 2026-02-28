import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Redirect to dashboard login, preserving the current URL as a return path
  const returnUrl = encodeURIComponent(location.href);
  window.location.href = `${environment.dashboardUrl}/login?returnUrl=${returnUrl}`;
  return false;
};
