import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const userId = auth.getUser()?.id;
  if (userId) {
    req = req.clone({ setHeaders: { 'X-User-Id': userId } });
  }
  return next(req);
};
