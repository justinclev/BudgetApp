import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionService } from '../services/transaction.service';
import { DebtService } from '../services/debt.service';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { BalanceCalculationService } from '../services/balance-calculation.service';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TransactionDetailComponent } from '../transaction-detail/transaction-detail';

interface TransactionGroup {
  id: string; // unique key for trackBy
  label: string;
  date: Date; // For sorting/reference
  transactions: Transaction[];
  count: number;
  totalAmount: number;
  startBalance: number | null;
  endBalance: number | null;
  // Group-level metrics
  groupIncome: number;
  groupExpenses: number;
  groupSavings: number;
  debtPayments: number;
  debtPaymentCount: number;
}

type GroupingMethod = 'Daily' | 'Weekly' | 'BiWeekly' | 'SemiMonthly' | 'Monthly' | 'Annually';

@Component({
  selector: 'app-list-transactions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatDialogModule,
  ],
  templateUrl: './list-transactions.html',
  styleUrls: ['./list-transactions.scss'],
})
export class ListTransactionsComponent implements OnInit {
  @Input() currentBalance: number = 0; // Default balance from dashboard

  isLoading = true;
  allTransactions: Transaction[] = [];
  groupedTransactions: TransactionGroup[] = [];
  expandedGroups = new Set<string>();

  // Cache for recalculations
  debts: Debt[] = [];
  recurringTransactions: RecurringTransaction[] = [];

  groupingOptions: GroupingMethod[] = [
    'Daily',
    'Weekly',
    'BiWeekly',
    'SemiMonthly',
    'Monthly',
    'Annually',
  ];
  selectedGrouping: GroupingMethod = 'Monthly';

  constructor(
    private transactionService: TransactionService,
    private debtService: DebtService,
    private recurringTransactionService: RecurringTransactionService,
    private balanceCalculationService: BalanceCalculationService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.isLoading = true;

    forkJoin({
      transactions: this.transactionService.getTransactions(),
      debts: this.debtService.getDebts(),
      recurring: this.recurringTransactionService.getTransactions(),
    }).subscribe({
      next: ({ transactions, debts, recurring }) => {
        this.debts = debts;
        this.recurringTransactions = recurring;

        // Ensure dates are Date objects and sort ascending for balance calculation
        this.allTransactions = transactions
          .map((t) => ({
            ...t,
            date: new Date(t.date),
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        this.recalculateAndGroup();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching data', err);
        this.isLoading = false;
      },
    });
  }

  recalculateAndGroup(): void {
    // Filter out deleted transactions for calculations
    const activeTransactions = this.allTransactions.filter((t) => !t.deleted);
    this.balanceCalculationService.calculateBalances(
      activeTransactions,
      this.debts,
      this.recurringTransactions,
      this.currentBalance,
    );
    this.updateGrouping();
  }

  updateGrouping(): void {
    // Filter out deleted transactions for display
    const activeTransactions = this.allTransactions.filter((t) => !t.deleted);

    if (!activeTransactions.length) {
      this.groupedTransactions = [];
      return;
    }

    const groups = new Map<string, TransactionGroup>();
    const rtMap = new Map<string, RecurringTransaction>();
    this.recurringTransactions.forEach((rt) => {
      if (rt._id) rtMap.set(rt._id, rt);
    });

    activeTransactions.forEach((t) => {
      const key = this.getGroupKey(t.date, this.selectedGrouping);
      const label = this.getGroupLabel(t.date, this.selectedGrouping);

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          label: label,
          date: this.getGroupDate(t.date, this.selectedGrouping),
          transactions: [],
          count: 0,
          totalAmount: 0,
          startBalance: null,
          endBalance: null,
          groupIncome: 0,
          groupExpenses: 0,
          groupSavings: 0,
          debtPayments: 0,
          debtPaymentCount: 0,
        });
      }

      const group = groups.get(key)!;
      group.transactions.push(t);
      group.count++;
      group.totalAmount += t.amount;

      // Calculate income/expenses for the group
      if (t.type === 'Income') {
        group.groupIncome += t.amount;
      } else {
        group.groupExpenses += t.amount;
      }

      // Check if this is a debt payment
      if (t.referenceId) {
        const rt = rtMap.get(t.referenceId);
        if (rt?.linkedDebtId) {
          group.debtPayments += t.amount;
          group.debtPaymentCount++;
        }
      }

      if (group.startBalance === null && t.balances) {
        group.startBalance = t.balances.BalancePrior;
      }

      if (t.balances) {
        group.endBalance = t.balances.BalanceAfter;
      }
    });

    // Calculate group savings
    groups.forEach((group) => {
      group.groupSavings = group.groupIncome - group.groupExpenses;
    });

    this.groupedTransactions = Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // Auto-expand the most recent group
    if (this.groupedTransactions.length > 0 && this.expandedGroups.size === 0) {
      const lastGroup = this.groupedTransactions[this.groupedTransactions.length - 1];
      this.expandedGroups.add(lastGroup.id);
    }
  }

  // --- Group Expand/Collapse ---
  toggleGroup(groupId: string): void {
    if (this.expandedGroups.has(groupId)) {
      this.expandedGroups.delete(groupId);
    } else {
      this.expandedGroups.add(groupId);
    }
  }

  trackByGroupId(index: number, group: TransactionGroup): string {
    return group.id;
  }

  // --- Actions ---

  openCreateDialog(): void {
    const newTransaction: Transaction = {
      _id: '',
      name: '',
      date: new Date(),
      amount: 0,
      description: '',
      type: 'One-Time',
      referenceId: undefined,
    };

    const dialogRef = this.dialog.open(TransactionDetailComponent, {
      width: '500px',
      data: newTransaction,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Add new transaction to list
        this.allTransactions.push(result);
        this.allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
        this.recalculateAndGroup();
        this.saveChanges();
      }
    });
  }

  openEditDialog(transaction: Transaction): void {
    const dialogRef = this.dialog.open(TransactionDetailComponent, {
      width: '500px',
      data: transaction,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Update local list (handles both edits and soft deletes)
        const index = this.allTransactions.findIndex((t) => t === transaction);
        if (index !== -1) {
          this.allTransactions[index] = result;
          this.allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          this.recalculateAndGroup();
          this.saveChanges();
        }
      }
    });
  }

  deleteTransaction(transaction: Transaction): void {
    if (confirm(`Delete transaction "${transaction.name}"?`)) {
      // Mark as deleted (soft delete)
      transaction.deleted = true;
      this.recalculateAndGroup();
      this.saveChanges();
    }
  }

  saveChanges(): void {
    // Save entire list
    this.transactionService.saveTransactions(this.allTransactions).subscribe({
      next: () => {
        // Optionally show snackbar
      },
      error: (err) => {
        alert('Failed to save changes!');
        console.error(err);
      },
    });
  }

  generateNextMonth(): void {
    // Generate transactions for the next month starting from the latest transaction
    const lastTransaction = this.allTransactions[this.allTransactions.length - 1];
    if (!lastTransaction) return;

    const lastDate = new Date(lastTransaction.date);
    const startDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
    const endDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 2, 0);

    // Get current balance from the last transaction for future projections
    let currentBalance = 0;
    if (lastTransaction?.balances?.BalanceAfter !== undefined) {
      currentBalance = lastTransaction.balances.BalanceAfter;
    }

    // Import TransactionGenerator
    import('../generators/transaction-generator').then(({ TransactionGenerator }) => {
      const generator = new TransactionGenerator(
        this.recurringTransactions,
        this.debts,
        this.transactionService,
      );

      generator.Generate(startDate, endDate, currentBalance).then(() => {
        this.loadTransactions();
      });
    });
  }

  generateNextYear(): void {
    // Generate transactions for the next year starting from the latest transaction
    const lastTransaction = this.allTransactions[this.allTransactions.length - 1];
    if (!lastTransaction) return;

    const lastDate = new Date(lastTransaction.date);
    const startDate = new Date(lastDate.getFullYear() + 1, lastDate.getMonth(), 1);
    const endDate = new Date(lastDate.getFullYear() + 2, lastDate.getMonth(), 0);

    // Get current balance from the last transaction for future projections
    let currentBalance = 0;
    if (lastTransaction?.balances?.BalanceAfter !== undefined) {
      currentBalance = lastTransaction.balances.BalanceAfter;
    }

    // Import TransactionGenerator
    import('../generators/transaction-generator').then(({ TransactionGenerator }) => {
      const generator = new TransactionGenerator(
        this.recurringTransactions,
        this.debts,
        this.transactionService,
      );

      generator.Generate(startDate, endDate, currentBalance).then(() => {
        this.loadTransactions();
      });
    });
  }

  // --- Grouping Helpers ---
  private getGroupKey(date: Date, method: GroupingMethod): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    switch (method) {
      case 'Daily':
        return `${year}-${month}-${day}`;
      case 'Weekly':
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek;
        const sunday = new Date(d.setDate(diff));
        return `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`;
      case 'BiWeekly':
        const epoch = new Date(year, 0, 1);
        const diffInMs = d.getTime() - epoch.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        const biWeekPeriod = Math.floor(diffInDays / 14);
        return `${year}-biweek-${biWeekPeriod}`;
      case 'SemiMonthly':
        const half = day <= 14 ? '1' : '2';
        return `${year}-${month}-${half}`;
      case 'Monthly':
        return `${year}-${month}`;
      case 'Annually':
        return `${year}`;
    }
  }

  private getGroupLabel(date: Date, method: GroupingMethod): string {
    switch (method) {
      case 'Daily':
        return date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      case 'Weekly':
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        const startDiff = d.getDate() - dayOfWeek;
        const startOfWeek = new Date(d.getFullYear(), d.getMonth(), startDiff);
        return `Week of ${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      case 'BiWeekly':
        const biWeekD = new Date(date);
        const epoch = new Date(biWeekD.getFullYear(), 0, 1);
        const diffInMs = biWeekD.getTime() - epoch.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        const biWeekStartDay = Math.floor(diffInDays / 14) * 14;
        const biWeekStartDate = new Date(biWeekD.getFullYear(), 0, 1 + biWeekStartDay);
        const biWeekEndDate = new Date(biWeekStartDate);
        biWeekEndDate.setDate(biWeekEndDate.getDate() + 13);
        return `${biWeekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${biWeekEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'SemiMonthly':
        const semiDay = date.getDate();
        const monthYear = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (semiDay <= 14) {
          return `${monthYear} (1st-14th)`;
        } else {
          return `${monthYear} (15th-31st)`;
        }
      case 'Monthly':
        return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      case 'Annually':
        return date.getFullYear().toString();
    }
  }

  private getGroupDate(date: Date, method: GroupingMethod): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    switch (method) {
      case 'Daily':
        return d;
      case 'Weekly':
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek;
        return new Date(d.setDate(diff));
      case 'BiWeekly':
        const biWeekD = new Date(d);
        const epoch = new Date(biWeekD.getFullYear(), 0, 1);
        const diffInMs = biWeekD.getTime() - epoch.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        const biWeekStartDay = Math.floor(diffInDays / 14) * 14;
        return new Date(biWeekD.getFullYear(), 0, 1 + biWeekStartDay);
      case 'SemiMonthly':
        const semiDay = d.getDate();
        if (semiDay <= 14) {
          return new Date(d.getFullYear(), d.getMonth(), 1);
        } else {
          return new Date(d.getFullYear(), d.getMonth(), 15);
        }
      case 'Monthly':
        return new Date(d.getFullYear(), d.getMonth(), 1);
      case 'Annually':
        return new Date(d.getFullYear(), 0, 1);
    }
  }
}
