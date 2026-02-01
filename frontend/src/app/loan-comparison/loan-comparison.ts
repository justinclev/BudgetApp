import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

import { Debt } from '../models/debt.model';
import { LoanDetails, LoanComparisonResult } from '../models/loan-comparison.model';
import { FinancialAdvisory } from '../models/loan-advisory.model';
import { LoanComparisonService } from '../services/loan-comparison.service';
import { DebtService } from '../services/debt.service';

@Component({
  selector: 'app-loan-comparison',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatIconModule,
  ],
  templateUrl: './loan-comparison.html',
  styleUrls: ['./loan-comparison.scss'],
})
export class LoanComparisonComponent implements OnInit {
  loanForm!: FormGroup;
  allDebts: Debt[] = [];
  selectedDebts: Set<string> = new Set();
  comparisonResult: LoanComparisonResult | null = null;
  advisory: FinancialAdvisory | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private loanService: LoanComparisonService,
    private debtService: DebtService,
    public dialogRef: MatDialogRef<LoanComparisonComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.loanForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(100)]],
      interestRate: ['', [Validators.required, Validators.min(0), Validators.max(30)]],
      term: ['', [Validators.required, Validators.min(1), Validators.max(360)]],
      originationFeePercent: ['0', [Validators.min(0), Validators.max(10)]],
    });
  }

  ngOnInit(): void {
    this.loadDebts();
  }

  loadDebts(): void {
    this.isLoading = true;
    this.debtService.getDebts().subscribe({
      next: (debts) => {
        this.allDebts = debts;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load debts';
        this.isLoading = false;
      },
    });
  }

  toggleDebtSelection(debtId: string): void {
    if (this.selectedDebts.has(debtId)) {
      this.selectedDebts.delete(debtId);
    } else {
      this.selectedDebts.add(debtId);
    }
  }

  isDebtSelected(debtId: string): boolean {
    return this.selectedDebts.has(debtId);
  }

  runComparison(): void {
    if (!this.loanForm.valid || this.selectedDebts.size === 0) {
      this.error = 'Please fill in all loan details and select at least one debt';
      return;
    }

    const loan: LoanDetails = this.loanForm.value;
    const selected = this.allDebts.filter((d) => this.selectedDebts.has(d._id || ''));

    this.comparisonResult = this.loanService.generateComparison(loan, selected);
    this.advisory = this.loanService.analyzeComparison(this.comparisonResult);
    this.error = null;
  }

  get selectedDebtCount(): number {
    return this.selectedDebts.size;
  }

  get totalCurrentCost(): number {
    return this.comparisonResult?.currentScenarioTotalCost || 0;
  }

  get totalLoanCost(): number {
    return this.comparisonResult?.totalLoanCost || 0;
  }

  get totalSavings(): number {
    return this.comparisonResult?.totalCostSavings || 0;
  }

  get isSavingsPositive(): boolean {
    return (this.comparisonResult?.totalCostSavings || 0) > 0;
  }

  getRatingColor(): string {
    if (!this.advisory) return '#999';
    switch (this.advisory.overallRating) {
      case 'good':
        return '#4caf50';
      case 'reasonable':
        return '#8bc34a';
      case 'fair':
        return '#ffc107';
      case 'marginal':
        return '#ff9800';
      case 'poor':
        return '#f44336';
      default:
        return '#999';
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
  }
}
