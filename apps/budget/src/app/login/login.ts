import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  standalone: true,
  imports: [MatButtonModule, MatCardModule]
})
export class LoginComponent {
  constructor(private router: Router) {}

  loginWithGoogle() {
    // TODO: Implement actual Google Login logic
    console.log('Logging in with Google...');
    this.router.navigate(['/dashboard']);
  }
}