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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

interface TransactionGroup {
  id: string; // unique key for trackBy
  label: string;
  date: Date; // For sorting/reference
  transactions: Transaction[];
  count: number;
  totalAmount: number;
  startBalance: number | null;
  endBalance: number | null;
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
    MatSelectModule,
    MatFormFieldModule,
    MatExpansionModule,
    FormsModule,
  ],
  templateUrl: './view-transactions.html',
  styleUrls: ['./view-transactions.scss'],
})
export class ViewTransactionsComponent implements OnInit {
  isLoading = true;
  allTransactions: Transaction[] = [];
  groupedTransactions: TransactionGroup[] = [];

  groupingOptions: GroupingMethod[] = ['Daily', 'Weekly', 'Monthly', 'Annually'];
  selectedGrouping: GroupingMethod = 'Monthly';

  constructor(
    private transactionService: TransactionService,
    private debtService: DebtService,
    private recurringTransactionService: RecurringTransactionService,
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
        // Ensure dates are Date objects and sort ascending for balance calculation
        const sorted = transactions
          .map((t) => ({
            ...t,
            date: new Date(t.date),
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        // Calculate balances (using 5000 as default starting balance)
        this.calculateBalances(sorted, debts, recurring, 5000);

        this.allTransactions = sorted;
        this.updateGrouping();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching data', err);
        this.isLoading = false;
      },
    });
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
      runningBalance -= t.amount;
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
        });
      }

      const group = groups.get(key)!;
      group.transactions.push(t);
      group.count++;
      group.totalAmount += t.amount;

      if (group.startBalance === null && t.balances) {
        group.startBalance = t.balances.BalancePrior;
      }

      if (t.balances) {
        group.endBalance = t.balances.BalanceAfter;
      }
    });

    this.groupedTransactions = Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }

  private getGroupKey(date: Date, method: GroupingMethod): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    switch (method) {
      case 'Daily':
        return `${year}-${month}-${day}`;
      case 'Weekly':
        // Get start of week (Sunday)
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
    const options: Intl.DateTimeFormatOptions = {};
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
        const endOfWeek = new Date(d.getFullYear(), d.getMonth(), startDiff + 6);
        return `Week of ${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      case 'Monthly':
        return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      case 'Annually':
        return date.getFullYear().toString();
    }
  }

  private getGroupDate(date: Date, method: GroupingMethod): Date {
    // Return a Date object representing the start of the group for sorting
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

  toggleGroup(group: any) {
    // handled by mat-expansion-panel
  }
}
