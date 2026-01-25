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
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { FREQUENCIES } from '../models/frequency.model';
import { Observable, map, catchError, of, timer, switchMap } from 'rxjs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

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
    MatButtonToggleModule
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

  constructor(
    private fb: FormBuilder,
    private transactionService: RecurringTransactionService,
    private dialogRef: MatDialogRef<RecurringTransactionDetailComponent>,
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
      type: [data?.type || 'expense', Validators.required]
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
          this.transactionService.checkNameExists(control.value, this.editingId || undefined),
        ),
        map((response) => (response.exists ? { nameTaken: true } : null)),
        catchError(() => of(null)),
      );
    };
  }

  onSubmit() {
    this.submissionError = null;

    if (this.transactionForm.valid) {
      const transactionData = this.transactionForm.value;
      let request: Observable<RecurringTransaction>;

      if (this.isEditMode && this.editingId) {
        request = this.transactionService.updateTransaction(this.editingId, transactionData);
      } else {
        request = this.transactionService.createTransaction(transactionData);
      }

      request.subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.submissionError =
            err.error?.message || 'An error occurred while saving the transaction.';
        },
      });
    } else {
      this.transactionForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onDelete(): void {
    if (confirm(`Delete "${this.data?.name}"?`)) {
      if (this.editingId) {
        this.transactionService.deleteTransaction(this.editingId).subscribe({
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
