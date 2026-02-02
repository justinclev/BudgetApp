import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Transaction } from '../models/transaction.model';

@Component({
  selector: 'app-transaction-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './transaction-detail.html',
  styleUrls: ['./transaction-detail.scss'],
})
export class TransactionDetailComponent implements OnInit {
  transactionForm: FormGroup;
  isEditMode = false;
  types = ['One-Time', 'Recurring', 'Debt', 'Income'];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TransactionDetailComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Transaction | null,
  ) {
    this.isEditMode = !!data;

    this.transactionForm = this.fb.group({
      name: [data?.name || '', [Validators.required]],
      description: [data?.description || ''],
      amount: [data?.amount || null, [Validators.required, Validators.min(0.01)]],
      date: [data?.date ? new Date(data.date) : new Date(), [Validators.required]],
      type: [data?.type || 'One-Time', [Validators.required]],
    });
  }

  ngOnInit(): void {
    // If editing a recurring transaction instance, maybe warn user?
    // For now just allow editing.
  }

  onSubmit(): void {
    if (this.transactionForm.valid) {
      const formValue = this.transactionForm.value;

      const result: Transaction = {
        ...this.data, // Keep existing ID and other props
        name: formValue.name,
        description: formValue.description,
        amount: formValue.amount,
        date: formValue.date,
        type: formValue.type,
      };

      this.dialogRef.close(result);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onDelete(): void {
    if (confirm(`Delete "${this.data?.name}"?`)) {
      // Mark as deleted (soft delete)
      const result: Transaction = {
        ...this.data,
        name: this.data?.name || '',
        description: this.data?.description || '',
        amount: this.data?.amount || 0,
        date: this.data?.date || new Date(),
        type: this.data?.type || 'One-Time',
        deleted: true,
      };
      this.dialogRef.close(result);
    }
  }
}
