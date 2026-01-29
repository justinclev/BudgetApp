import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionService } from '../services/transaction.service';
import { DebtService } from '../services/debt.service';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
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

type GroupingMethod = 'Daily' | 'Weekly' | 'Monthly' | 'Annually';

@Component({
  selector: 'app-view-transactions',
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
  templateUrl: './view-transactions.html',
  styleUrls: ['./view-transactions.scss'],
})
export class ViewTransactionsComponent implements OnInit {
  isLoading = true;
  allTransactions: Transaction[] = [];
  groupedTransactions: TransactionGroup[] = [];
  expandedGroups = new Set<string>();

  // Cache for recalculations
  debts: Debt[] = [];
  recurringTransactions: RecurringTransaction[] = [];

  groupingOptions: GroupingMethod[] = ['Daily', 'Weekly', 'Monthly', 'Annually'];
  selectedGrouping: GroupingMethod = 'Monthly';

  constructor(
    private transactionService: TransactionService,
    private debtService: DebtService,
    private recurringTransactionService: RecurringTransactionService,
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
    this.calculateBalances(this.allTransactions, this.debts, this.recurringTransactions, 5000);
    this.updateGrouping();
  }

  private calculateBalances(
    transactions: Transaction[],
    debts: Debt[],
    recurring: RecurringTransaction[],
    initialBalance: number,
  ) {
    let runningBalance = initialBalance;
    const debtBalances = new Map<string, number>();

    debts.forEach((d) => {
      if (d._id) debtBalances.set(d._id, d.amountOwed);
    });

    const rtMap = new Map<string, RecurringTransaction>();
    recurring.forEach((rt) => {
      if (rt._id) rtMap.set(rt._id, rt);
    });

    for (const t of transactions) {
      const balancePrior = runningBalance;
      if (t.type === 'Income') {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }
      const balanceAfter = runningBalance;
      let debtPrior: number | undefined;
      let debtAfter: number | undefined;

      if (t.referenceId) {
        const rt = rtMap.get(t.referenceId);
        if (rt && rt.linkedDebtId) {
          debtPrior = debtBalances.get(rt.linkedDebtId);
          if (debtPrior !== undefined) {
            debtAfter = debtPrior - t.amount;
            debtBalances.set(rt.linkedDebtId, debtAfter);
          }
        }
      }

      t.balances = {
        BalancePrior: balancePrior,
        BalanceAfter: balanceAfter,
        DebtBalancePrior: debtPrior,
        DebtBalanceAfter: debtAfter,
      };
    }
  }

  updateGrouping(): void {
    if (!this.allTransactions.length) {
      this.groupedTransactions = [];
      return;
    }

    const groups = new Map<string, TransactionGroup>();
    const rtMap = new Map<string, RecurringTransaction>();
    this.recurringTransactions.forEach((rt) => {
      if (rt._id) rtMap.set(rt._id, rt);
    });

    this.allTransactions.forEach((t) => {
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
      if (result === 'deleted') {
        // Handle deletion from dialog
        this.allTransactions = this.allTransactions.filter((t) => t !== transaction);
        this.recalculateAndGroup();
        this.saveChanges();
      } else if (result) {
        // Update local list
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
      this.allTransactions = this.allTransactions.filter((t) => t !== transaction);
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
      case 'Monthly':
        return new Date(d.getFullYear(), d.getMonth(), 1);
      case 'Annually':
        return new Date(d.getFullYear(), 0, 1);
    }
  }
}
