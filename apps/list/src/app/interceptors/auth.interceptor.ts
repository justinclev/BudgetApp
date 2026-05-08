import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const user = auth.getUser();
  if (token && user) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'X-User-Id': user.id,
      },
    });
  }
  return next(req);
};
