import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { CreateRecurringTransactionComponent } from '../create-recurring-transaction/create-recurring-transaction';

@Component({
  selector: 'app-list-recurring-transaction',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule
  ],
  templateUrl: './list-recurring-transaction.html',
  styleUrls: ['./list-recurring-transaction.scss']
})
export class ListRecurringTransactionComponent implements OnInit {
  transactions: RecurringTransaction[] = [];

  constructor(
    private transactionService: RecurringTransactionService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.transactionService.getTransactions().subscribe({
      next: (data) => this.transactions = data,
      error: (err) => console.error('Error fetching transactions', err)
    });
  }

  openTransactionDialog(transaction?: RecurringTransaction): void {
    const dialogRef = this.dialog.open(CreateRecurringTransactionComponent, {
      width: '600px',
      data: transaction // Pass transaction for edit mode, or null for add
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTransactions(); // Refresh list if changed
      }
    });
  }

  deleteTransaction(id: string): void {
    if (confirm('Are you sure you want to delete this transaction?')) {
      this.transactionService.deleteTransaction(id).subscribe({
        next: () => this.loadTransactions(),
        error: (err) => alert('Failed to delete transaction')
      });
    }
  }
}