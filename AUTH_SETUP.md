# Authentication Setup

## Overview
Authentication is now centralized at the dashboard level. Users must log in before accessing any apps (dashboard or budget).

## Key Changes

### Dashboard App
- **Login Page**: Located at `/login` - handles all user authentication
- **AuthService**: Manages authentication state, login, logout, and user data storage
- **Auth Guard**: Protects all routes except `/login` - redirects unauthenticated users to login
- **Dashboard Component**: Main app listing page with logout button
- **Top Bar**: Shows logout button for quick access

### Budget App
- **Login Removed**: No longer has login functionality
- **Routes Simplified**: Direct access to budget features without login redirect
- **Protected by Parent**: Accessed through `/budget` route which is protected by auth guard

## File Structure

```
apps/dashboard/src/app/
├── services/
│   └── auth.service.ts          # Authentication service
├── guards/
│   └── auth.guard.ts            # Route protection guard
├── login/
│   └── login.component.ts        # Login page
├── app.routes.ts                # Routes with auth guard
├── app.ts                        # Main dashboard component
└── app.html                      # Dashboard template with logout

apps/budget/src/app/
├── app.routes.ts                # Simplified routes (no login)
└── ... (login component removed)
```

## How It Works

1. **User visits the app** → Redirected to `/login` if not authenticated
2. **User logs in** → AuthService stores user data in localStorage
3. **AuthService updates** → `isAuthenticated` signal becomes true
4. **User redirected** → Router navigates to `/dashboard`
5. **Dashboard loads** → Shows app cards (Budget App, etc.)
6. **User navigates to app** → Auth guard checks authentication before allowing access
7. **User clicks logout** → AuthService clears data and redirects to `/login`

## Using Shared Auth in Budget App

If you want to add a logout button in the budget app:

```typescript
import { AuthService } from '../../services/auth.service';

export class MyComponent {
  constructor(private authService: AuthService) {}
  
  logout() {
    this.authService.logout();
  }
}
```

## Next Steps: Real Google Login

Currently, the login is mocked. To implement real Google login:

1. Set up Google OAuth credentials
2. Install `@angular/google-identity-services`
3. Update `LoginComponent.loginWithGoogle()` to use actual Google authentication
4. Store real user tokens in AuthService

## Local Development

```bash
# Run dashboard (includes login and app selection)
./frontend-dev.sh dashboard

# Run budget app in separate terminal (for testing)
./frontend-dev.sh budget local
```
