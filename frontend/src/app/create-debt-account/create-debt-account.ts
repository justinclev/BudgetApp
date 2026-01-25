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
import { DebtService } from '../services/debt.service';
import { Debt } from '../models/debt.model';
import { RecurringTransactionService } from '../services/recurring-transaction.service';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { FREQUENCIES } from '../models/frequency.model';
import { Observable, map, catchError, of, timer, switchMap } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-create-debt-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatCheckboxModule,
  ],
  templateUrl: './create-debt-account.html',
  styleUrls: ['./create-debt-account.scss'],
})
export class CreateDebtAccountComponent {
  debtForm: FormGroup;
  frequencies = FREQUENCIES;
  submissionError: string | null = null;
  isEditMode: boolean = false;
  editingId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private debtService: DebtService,
    private recurringTransactionService: RecurringTransactionService,
    private dialogRef: MatDialogRef<CreateDebtAccountComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: Debt,
  ) {
    this.isEditMode = !!data;
    if (this.isEditMode) {
      this.editingId = data._id || null;
    }

    const hasRecurringDetails = !!(data?.frequency && data?.paymentDate && data?.minimumPayment);

    this.debtForm = this.fb.group({
      name: [data?.name || '', [Validators.required], [this.nameUniqueValidator()]],
      amountOwed: [
        data?.amountOwed || null,
        [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)],
      ],
      interestRate: [
        data?.interestRate || null,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      createRecurring: [hasRecurringDetails],
      minimumPayment: [data?.minimumPayment || null],
      paymentDate: [data?.paymentDate || ''],
      frequency: [data?.frequency || ''],
    });

    this.updateValidators(hasRecurringDetails);

    this.debtForm.get('createRecurring')?.valueChanges.subscribe((checked) => {
      this.updateValidators(checked);
    });
  }

  updateValidators(isChecked: boolean) {
    const controls = ['minimumPayment', 'paymentDate', 'frequency'];
    controls.forEach((controlName) => {
      const control = this.debtForm.get(controlName);
      if (isChecked) {
        control?.setValidators([Validators.required]);
        if (controlName === 'minimumPayment') {
          control?.addValidators(Validators.pattern(/^\d+(\.\d{1,2})?$/));
        }
      } else {
        control?.clearValidators();
      }
      control?.updateValueAndValidity();
    });
  }

  nameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }
      // If editing and name hasn't changed, it's valid
      if (this.isEditMode && control.value === this.data.name) {
        return of(null);
      }
      return timer(500).pipe(
        switchMap(() =>
          this.debtService.checkNameExists(control.value, this.editingId || undefined),
        ),
        map((response) => (response.exists ? { nameTaken: true } : null)),
        catchError(() => of(null)),
      );
    };
  }

  onSubmit() {
    this.submissionError = null;

    if (this.debtForm.valid) {
      const debtData = this.debtForm.value;
      const createRecurring = this.debtForm.get('createRecurring')?.value;
      
      // For new debts, set currentBalance to amountOwed if not present
      if (!this.isEditMode) {
        debtData.currentBalance = debtData.amountOwed;
      }
      
      let request: Observable<Debt>;

      if (this.isEditMode && this.editingId) {
        request = this.debtService.updateDebt(this.editingId, debtData);
      } else {
        request = this.debtService.createDebt(debtData);
      }

      request.pipe(
        switchMap((savedDebt) => {
          if (createRecurring && debtData.minimumPayment && debtData.paymentDate && debtData.frequency) {
            const transactionName = `Payment for ${savedDebt.name}`;
            const transaction: RecurringTransaction = {
              name: transactionName,
              description: `Recurring payment for ${savedDebt.name}`,
              amount: debtData.minimumPayment,
              startingDate: debtData.paymentDate,
              frequency: debtData.frequency,
              linkedDebtId: savedDebt._id
            };

            // Attempt to find existing transaction to update, or create new
            return this.recurringTransactionService.getTransactions().pipe(
              switchMap(transactions => {
                const existing = transactions.find(t => t.name === transactionName || t.linkedDebtId === savedDebt._id);
                if (existing && existing._id) {
                  return this.recurringTransactionService.updateTransaction(existing._id, transaction);
                } else {
                  return this.recurringTransactionService.createTransaction(transaction);
                }
              }),
              map(() => savedDebt)
            );
          } else {
            return of(savedDebt);
          }
        })
      ).subscribe({
          next: () => {
            this.dialogRef.close(true);
          },
          error: (err) => {
            this.submissionError = err.error?.message || 'An error occurred while saving the debt.';
          },
        });
    } else {
      this.debtForm.markAllAsTouched();
    }
  }

  get f() {
    return this.debtForm.controls;
  }
}
