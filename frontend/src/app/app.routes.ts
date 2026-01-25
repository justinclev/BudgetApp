import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { DashboardComponent } from './dashboard/dashboard';
import { CreateRecurringTransactionComponent } from './create-recurring-transaction/create-recurring-transaction';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'create-recurring-transaction', component: CreateRecurringTransactionComponent },
];
