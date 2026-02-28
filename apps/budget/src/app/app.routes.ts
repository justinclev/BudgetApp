import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { RecurringTransactionDetailComponent } from './recurring-transaction-detail/recurring-transaction-detail';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'recurring-transaction-detail', component: RecurringTransactionDetailComponent },
];
