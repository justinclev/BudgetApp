import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { DashboardComponent } from './dashboard/dashboard';
import { RecurringTransactionDetailComponent } from './recurring-transaction-detail/recurring-transaction-detail';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'recurring-transaction-detail', component: RecurringTransactionDetailComponent },
];
