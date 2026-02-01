import { Component, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  AsyncValidatorFn,
} from '@angular/forms';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { TransactionService } from '../services/transaction.service';
import { DebtService } from '../services/debt.service';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { FREQUENCIES } from '../models/frequency.model';
import { Observable, map, catchError, of, timer, switchMap, firstValueFrom } from 'rxjs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { TransactionGenerator } from '../generators/transaction-generator';
import { ConfirmationDialogComponent } from '../shared/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-recurring-transaction-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
  ],
  templateUrl: './recurring-transaction-detail.html',
  styleUrls: ['./recurring-transaction-detail.scss'],
})
export class RecurringTransactionDetailComponent {
  transactionForm: FormGroup;
  frequencies = FREQUENCIES;
  submissionError: string | null = null;
  isEditMode: boolean = false;
  editingId: string | null = null;
  isSubmitting: boolean = false;

  constructor(
    private fb: FormBuilder,
    private recurringTransactionService: RecurringTransactionService,
    private dialogRef: MatDialogRef<RecurringTransactionDetailComponent>,
    private transactionService: TransactionService,
    private debtService: DebtService,
    private confirmDialog: MatDialog,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: RecurringTransaction,
  ) {
    this.isEditMode = !!data;
    if (this.isEditMode) {
      this.editingId = data._id || null;
    }

    this.transactionForm = this.fb.group({
      name: [data?.name || '', [Validators.required], [this.nameUniqueValidator()]],
      description: [data?.description || '', Validators.required],
      amount: [
        data?.amount || null,
        [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)],
      ],
      frequency: [data?.frequency || '', Validators.required],
      startingDate: [data?.startingDate || '', Validators.required],
      type: [data?.type || 'expense', Validators.required],
    });
  }

  nameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }
      if (this.isEditMode && control.value === this.data.name) {
        return of(null);
      }

      return timer(500).pipe(
        switchMap(() =>
          this.recurringTransactionService.checkNameExists(
            control.value,
            this.editingId || undefined,
          ),
        ),
        map((response) => (response.exists ? { nameTaken: true } : null)),
        catchError(() => of(null)),
      );
    };
  }

  async onSubmit(): Promise<void> {
    this.submissionError = null;

    if (!this.transactionForm.valid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    // For updates, confirm that regeneration will occur
    if (this.isEditMode && this.editingId) {
      const confirmed = await this.confirmProjectionUpdate();
      if (!confirmed) {
        // User cancelled - do nothing, stay in dialog
        console.log('⚠️  User cancelled projection update');
        return;
      }
    }

    this.isSubmitting = true;
    const transactionData = this.transactionForm.value;
    const request =
      this.isEditMode && this.editingId
        ? this.recurringTransactionService.updateTransaction(this.editingId, transactionData)
        : this.recurringTransactionService.createTransaction(transactionData);

    request.subscribe({
      next: async (savedRecurring) => {
        try {
          console.log('💾 Recurring transaction saved, generating transactions...');

          // Generate transactions for this specific recurring transaction
          const replace = this.isEditMode; // true for update, false for create
          await this.generateTransactionsForRecurring(savedRecurring._id!, replace);

          console.log('✅ Transactions generated successfully');
          this.dialogRef.close(true);
        } catch (err) {
          console.error('Failed to regenerate transactions:', err);
          // Transaction was saved, close with warning
          this.dialogRef.close(true);
        } finally {
          this.isSubmitting = false;
        }
      },
      error: (err) => {
        this.submissionError =
          err.error?.message || 'An error occurred while saving the transaction.';
        this.isSubmitting = false;
      },
    });
  }

  /** Prompts user to confirm that updating will regenerate projections */
  private async confirmProjectionUpdate(): Promise<boolean> {
    console.log('🔄 Showing projection update confirmation dialog');

    return new Promise((resolve) => {
      const dialogRef = this.confirmDialog.open(ConfirmationDialogComponent, {
        data: {
          title: 'Recalculate Forecast?',
          message: 'This change will update your financial forecast and all relevant transactions.',
          confirmText: 'Yes',
          cancelText: 'No',
        },
        width: '90%',
        maxWidth: '450px',
        panelClass: 'confirmation-dialog-panel',
      });

      dialogRef.afterClosed().subscribe((result) => {
        console.log('📋 Confirmation result:', result);
        resolve(result === true);
      });
    });
  }

  /** Generate transactions for the specific recurring transaction
   * @param recurringTransactionId The ID of the recurring transaction to generate for
   * @param replace If true, replace existing duplicates; if false, only add new
   */
  private async generateTransactionsForRecurring(
    recurringTransactionId: string,
    replace: boolean,
  ): Promise<void> {
    console.log(`🔄 Generating transactions for recurring ID: ${recurringTransactionId}`, {
      replace,
    });

    // Fetch all recurring transactions and debts
    const [allRecurringTransactions, allDebts] = await Promise.all([
      firstValueFrom(this.recurringTransactionService.getTransactions()),
      firstValueFrom(this.debtService.getDebts()),
    ]);

    // Create generator
    const generator = new TransactionGenerator(
      allRecurringTransactions,
      allDebts,
      this.transactionService,
    );

    // Get existing transactions to determine date range and balance
    const existingTransactions = await firstValueFrom(
      this.transactionService.getTransactions(),
    );

    // Calculate date range: if no transactions, generate 1 year from now; otherwise use first to last transaction dates
    let startDate: Date;
    let endDate: Date;

    if (existingTransactions.length === 0) {
      // No transactions: generate 1 year from current date
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear() + 1, now.getMonth(), 0);
    } else {
      // Use first transaction date as start and last transaction date as end
      const firstTransaction = existingTransactions[0];
      const lastTransaction = existingTransactions[existingTransactions.length - 1];
      startDate = new Date(firstTransaction.date);
      endDate = new Date(lastTransaction.date);
    }

    // Get current balance (from last transaction)
    let currentBalance = 5000; // Default starting balance
    if (existingTransactions.length > 0) {
      const lastTransaction = existingTransactions[existingTransactions.length - 1];
      currentBalance = lastTransaction.balances?.BalanceAfter ?? 5000;
    }

    console.log('📊 Generation parameters:', {
      startDate,
      endDate,
      currentBalance,
      recurringTransactionId,
      replace,
    });

    // Generate with appropriate strategy
    await generator.Generate(
      startDate,
      endDate,
      currentBalance,
      recurringTransactionId,
      replace,
    );
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onDelete(): void {
    if (confirm(`Delete "${this.data?.name}"?`)) {
      if (this.editingId) {
        this.recurringTransactionService.deleteTransaction(this.editingId).subscribe({
          next: () => this.dialogRef.close('deleted'),
          error: (err) => {
            this.submissionError = err.error?.message || 'Failed to delete transaction.';
          },
        });
      }
    }
  }

  get f() {
    return this.transactionForm.controls;
  }
}
