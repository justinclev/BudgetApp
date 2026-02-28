import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  dashboardUrl = location.hostname === 'localhost' ? 'http://localhost:4200' : '/';

  // This component is not used — the auth guard redirects directly to
  // the dashboard login. Kept as a fallback shell only.
  loginWithGoogle(): void {
    const mockUser = { id: '1', email: 'alice@example.com', name: 'Alice' };
    this.auth.login(mockUser);
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.router.navigateByUrl(redirect ?? '/');
  }
}
