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
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { ListRecurringTransactionComponent } from '../list-recurring-transaction/list-recurring-transaction';
import { RecurringTransactionDetailComponent } from '../recurring-transaction-detail/recurring-transaction-detail';
import { DebtDetailComponent } from '../debt-detail/debt-detail';
import { ListDebtComponent } from '../list-debt/list-debt';
import { ListTransactionsComponent } from '../list-transactions/list-transactions';
import { LoanComparisonComponent } from '../loan-comparison/loan-comparison';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { DebtService } from '../services/debt.service';
import { TransactionService } from '../services/transaction.service';
import { BalanceCalculationService } from '../services/balance-calculation.service';
import { forkJoin } from 'rxjs';
import { Debt } from '../models/debt.model';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Transaction } from '../models/transaction.model';

import { environment } from '../../environments/environment';

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
    FormsModule,
    MatInputModule,
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
  private previousBalance: number = 0;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private recurringTransactionService: RecurringTransactionService,
    private debtService: DebtService,
    private transactionService: TransactionService,
    private balanceCalculationService: BalanceCalculationService,
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
    // Current balance: use last transaction's BalanceAfter if available
    const sortedByDate = this.transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const lastTransaction = sortedByDate[sortedByDate.length - 1];

    if (lastTransaction?.balances?.BalanceAfter !== undefined) {
      this.metrics.currentBalance = lastTransaction.balances.BalanceAfter;
    } else if (sortedByDate[0]?.startingBalance !== undefined) {
      // If no transactions have balances calculated, use the first transaction's startingBalance
      this.metrics.currentBalance = sortedByDate[0].startingBalance;
    } else {
      // Default to 0 if no transactions exist
      this.metrics.currentBalance = 0;
    }

    this.previousBalance = this.metrics.currentBalance;

    // Total debt
    this.metrics.totalDebt = this.debts.reduce((sum, debt) => sum + debt.amountOwed, 0);

    // Current month metrics - filter out deleted transactions
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthTransactions = this.transactions.filter((t) => {
      const tDate = new Date(t.date);
      return !t.deleted && tDate >= monthStart && tDate <= monthEnd;
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

  goToApps(): void {
    window.location.href = environment.dashboardUrl;
  }

  openAddRecurringTransactionModal(): void {
    const dialogRef = this.dialog.open(RecurringTransactionDetailComponent, {
      width: '500px',
      data: {
        currentBalance: this.metrics.currentBalance,
      },
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
      data: {
        currentBalance: this.metrics.currentBalance,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDashboardData();
      }
    });
  }

  openLoanComparisonModal(): void {
    const dialogRef = this.dialog.open(LoanComparisonComponent, {
      width: '800px',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Loan comparison doesn't modify data, just for analysis
    });
  }

  openCreditAdviceModal(): void {
    // TODO: Create and open CreditAdviceComponent
    // This will provide educational guidance on building and maintaining credit
    console.log('Credit Advice modal - to be implemented');
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

  onBalanceBlur(): void {
    // Only recalculate if balance actually changed
    if (this.metrics.currentBalance !== this.previousBalance) {
      this.recalculateAllBalances(this.metrics.currentBalance);
      this.previousBalance = this.metrics.currentBalance;
    }
  }

  private recalculateAllBalances(newBalance: number): void {
    this.balanceCalculationService.calculateBalances(
      this.transactions,
      this.debts,
      this.recurringTransactions,
      newBalance,
    );

    // Set startingBalance on first transaction only
    if (this.transactions.length > 0) {
      this.transactions[0].startingBalance = newBalance;
    }

    // Save changes to database
    this.transactionService.saveTransactions(this.transactions).subscribe({
      next: () => {
        // Transactions saved
      },
      error: (err) => {
        console.error('Error saving transactions:', err);
      },
    });
  }
}
