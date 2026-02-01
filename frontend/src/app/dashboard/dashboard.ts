import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ListRecurringTransactionComponent } from '../list-recurring-transaction/list-recurring-transaction';
import { RecurringTransactionDetailComponent } from '../recurring-transaction-detail/recurring-transaction-detail';
import { DebtDetailComponent } from '../debt-detail/debt-detail';
import { ListDebtComponent } from '../list-debt/list-debt';
import { ListTransactionsComponent } from '../list-transactions/list-transactions';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { DebtService } from '../services/debt.service';
import { TransactionService } from '../services/transaction.service';
import { forkJoin } from 'rxjs';
import { Debt } from '../models/debt.model';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Transaction } from '../models/transaction.model';

interface DashboardMetrics {
  currentBalance: number;
  totalDebt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  upcomingPaymentCount: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatDividerModule,
    MatCardModule,
    MatTooltipModule,
    ListRecurringTransactionComponent,
    ListDebtComponent,
    ListTransactionsComponent,
  ],
})
export class DashboardComponent implements OnInit {
  isLoading = true;
  activeSection: 'transactions' | 'debt' | 'recurring' | null = null;
  metrics: DashboardMetrics = {
    currentBalance: 0,
    totalDebt: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlySavings: 0,
    upcomingPaymentCount: 0,
  };

  debts: Debt[] = [];
  recurringTransactions: RecurringTransaction[] = [];
  transactions: Transaction[] = [];

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private recurringTransactionService: RecurringTransactionService,
    private debtService: DebtService,
    private transactionService: TransactionService,
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    forkJoin({
      transactions: this.transactionService.getTransactions(),
      debts: this.debtService.getDebts(),
      recurring: this.recurringTransactionService.getTransactions(),
    }).subscribe({
      next: ({ transactions, debts, recurring }) => {
        this.transactions = transactions;
        this.debts = debts;
        this.recurringTransactions = recurring;
        this.calculateMetrics();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading dashboard data', err);
        this.isLoading = false;
      },
    });
  }

  private calculateMetrics(): void {
    // Current balance (last transaction)
    const sortedTransactions = this.transactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const lastTransaction = sortedTransactions[0];
    this.metrics.currentBalance = lastTransaction?.balances?.BalanceAfter ?? 0;

    // Total debt
    this.metrics.totalDebt = this.debts.reduce((sum, debt) => sum + debt.amountOwed, 0);

    // Current month metrics
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthTransactions = this.transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= monthStart && tDate <= monthEnd;
    });

    this.metrics.monthlyIncome = monthTransactions
      .filter((t) => t.type === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.metrics.monthlyExpenses = monthTransactions
      .filter((t) => t.type !== 'Income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.metrics.monthlySavings = this.metrics.monthlyIncome - this.metrics.monthlyExpenses;

    // Upcoming payment count
    this.metrics.upcomingPaymentCount = this.recurringTransactions.length;
  }

  logout(): void {
    this.router.navigate(['/login']);
  }

  openAddRecurringTransactionModal(): void {
    const dialogRef = this.dialog.open(RecurringTransactionDetailComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDashboardData();
      }
    });
  }

  openAddDebtAccountModal(): void {
    const dialogRef = this.dialog.open(DebtDetailComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDashboardData();
      }
    });
  }

  openSection(section: 'transactions' | 'debt' | 'recurring'): void {
    this.activeSection = section;
  }

  closeSection(): void {
    this.activeSection = null;
  }

  getSectionTitle(section: string): string {
    const titles: Record<string, string> = {
      transactions: 'Transactions',
      debt: 'Debt Accounts',
      recurring: 'Recurring Transactions',
    };
    return titles[section] || '';
  }
}
