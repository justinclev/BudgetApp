import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { ListRecurringTransactionComponent } from '../list-recurring-transaction/list-recurring-transaction';
import { RecurringTransactionDetailComponent } from '../recurring-transaction-detail/recurring-transaction-detail';
import { DebtDetailComponent } from '../debt-detail/debt-detail';
import { ListDebtComponent } from '../list-debt/list-debt';
import { ViewTransactionsComponent } from '../view-transactions/view-transactions';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { DebtService } from '../services/debt.service';
import { TransactionService } from '../services/transaction.service';
import { TransactionGenerator } from '../generators/transaction-generator';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  standalone: true,
  imports: [
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatDividerModule,
    ListRecurringTransactionComponent,
    ListDebtComponent,
    ViewTransactionsComponent,
  ],
})
export class DashboardComponent {
  constructor(
    private router: Router,
    private dialog: MatDialog,
    private recurringTransactionService: RecurringTransactionService,
    private debtService: DebtService,
    private transactionService: TransactionService,
  ) {}

  logout() {
    this.router.navigate(['/login']);
  }

  testGenerate() {
    forkJoin({
      recurring: this.recurringTransactionService.getTransactions(),
      debts: this.debtService.getDebts(),
    }).subscribe(({ recurring, debts }) => {
      const generator = new TransactionGenerator(recurring, debts, this.transactionService);

      // Set a date range (e.g., next 3 months)
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 3);

      // Using a test starting balance of 5000
      generator.Generate(start, end, 5000).then(() => {
        console.log('--- Generated Transactions with Balances ---');
        console.log('Start Date:', start);
        console.log('End Date:', end);
        console.log('Generated count:', generator.transactions.length);
        console.table(
          generator.transactions.map((t) => ({
            Date: t.date.toLocaleDateString(),
            Name: t.name,
            Amount: t.amount,
            'Acc Balance Prior': t.balances?.BalancePrior,
            'Acc Balance After': t.balances?.BalanceAfter,
            'Debt Prior': t.balances?.DebtBalancePrior,
            'Debt After': t.balances?.DebtBalanceAfter,
          })),
        );
      });
    });
  }

  openAddRecurringTransactionModal() {
    const dialogRef = this.dialog.open(RecurringTransactionDetailComponent, {
      width: '600px',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        window.location.reload();
      }
    });
  }

  openAddDebtAccountModal() {
    const dialogRef = this.dialog.open(DebtDetailComponent, {
      width: '600px',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        window.location.reload();
      }
    });
  }
}
