import { Injectable } from '@angular/core';
import { Debt } from '../models/debt.model';
import { LoanDetails, LoanComparisonResult, LoanDebtComparison } from '../models/loan-comparison.model';

/**
 * Service for calculating loan comparison scenarios
 * Compares the cost of paying off debts with current interest vs using a new loan
 */
@Injectable({
  providedIn: 'root',
})
export class LoanComparisonService {
  /**
   * Calculate total interest and payoff time for a debt with monthly minimum payment
   */
  calculateDebtPayoff(balance: number, annualInterestRate: number, monthlyPayment: number): {
    totalInterest: number;
    monthsToPayoff: number;
    totalPaid: number;
  } {
    let remaining = balance;
    let totalInterest = 0;
    let months = 0;
    const monthlyRate = annualInterestRate / 100 / 12;

    // If payment doesn't cover interest, use a sustainable payment (1% of original balance)
    let actualPayment = monthlyPayment;
    const minInterestPayment = balance * monthlyRate;
    if (monthlyPayment <= minInterestPayment) {
      // Payment is too low - use 1% of original balance as minimum
      actualPayment = Math.max(balance * 0.01, minInterestPayment * 1.1);
    }

    while (remaining > 0 && months < 600) {
      // 50 year max to prevent infinite loops
      const interestCharge = remaining * monthlyRate;
      totalInterest += interestCharge;
      remaining -= actualPayment - interestCharge;

      // Safety check: if remaining is very small, consider it paid off
      if (remaining < 0.01) {
        remaining = 0;
      }

      months++;
    }

    return {
      totalInterest,
      monthsToPayoff: months,
      totalPaid: balance + totalInterest,
    };
  }

  /**
   * Calculate monthly payment for a loan using standard amortization
   */
  calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
    if (annualRate === 0) {
      return principal / months;
    }

    const monthlyRate = annualRate / 100 / 12;
    const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
    const denominator = Math.pow(1 + monthlyRate, months) - 1;

    return numerator / denominator;
  }

  /**
   * Calculate total interest paid over loan term
   */
  calculateLoanInterest(monthlyPayment: number, principal: number, months: number): number {
    return monthlyPayment * months - principal;
  }

  /**
   * Compare current debt scenario vs paying off with new loan
   */
  compareDebtWithLoan(
    debt: Debt,
    loan: LoanDetails,
  ): LoanDebtComparison {
    const debtId = debt._id || '';
    const debtBalance = debt.amountOwed || 0;
    const debtRate = debt.interestRate || 0;

    // Current scenario - use the debt's minimum payment from record
    const minimumPayment = debt.minimumPayment || (debtBalance * 0.02); // Fall back to 2% if not set
    const currentPayoff = this.calculateDebtPayoff(debtBalance, debtRate, minimumPayment);

    // Loan scenario - pay off debt with loan
    const loanMonthlyPayment = this.calculateMonthlyPayment(debtBalance, loan.interestRate, loan.term);
    const loanInterest = this.calculateLoanInterest(loanMonthlyPayment, debtBalance, loan.term);

    return {
      debtId,
      debtName: debt.name,
      currentBalance: debtBalance,
      currentInterestRate: debtRate,

      currentTotalInterest: currentPayoff.totalInterest,
      currentMinimumPayment: minimumPayment,
      currentMonthsToPayoff: currentPayoff.monthsToPayoff,
      currentTotalPaid: currentPayoff.totalPaid,

      loanTotalInterest: loanInterest,
      loanMonthlyPayment,
      loanMonthsToPayoff: loan.term,
      loanTotalPaid: debtBalance + loanInterest,

      interestSavings: currentPayoff.totalInterest - loanInterest,
      isSavingsPositive: currentPayoff.totalInterest > loanInterest,
    };
  }

  /**
   * Generate comprehensive loan comparison report
   */
  generateComparison(
    loan: LoanDetails,
    selectedDebts: Debt[],
  ): LoanComparisonResult {
    // Calculate origination fee
    const originationFee = (loan.amount * loan.originationFeePercent) / 100;
    const totalLoanAmount = loan.amount + originationFee;

    // Calculate loan payment
    const monthlyLoanPayment = this.calculateMonthlyPayment(totalLoanAmount, loan.interestRate, loan.term);
    const totalLoanInterest = this.calculateLoanInterest(monthlyLoanPayment, totalLoanAmount, loan.term);
    const totalLoanCost = totalLoanAmount + totalLoanInterest;

    // Compare each debt
    const debtComparisons = selectedDebts.map((debt) =>
      this.compareDebtWithLoan(debt, loan),
    );

    // Calculate totals
    const currentScenarioTotalInterest = debtComparisons.reduce(
      (sum, comparison) => sum + comparison.currentTotalInterest,
      0,
    );
    const currentScenarioTotalCost = debtComparisons.reduce(
      (sum, comparison) => sum + comparison.currentTotalPaid,
      0,
    );

    const loanScenarioTotalInterest = debtComparisons.reduce(
      (sum, comparison) => sum + comparison.loanTotalInterest,
      0,
    );
    const loanScenarioTotalCost = debtComparisons.reduce(
      (sum, comparison) => sum + comparison.loanTotalPaid,
      0,
    ) + totalLoanInterest + originationFee;

    const totalInterestSavings = currentScenarioTotalInterest - loanScenarioTotalInterest;
    const totalCostSavings = currentScenarioTotalCost - loanScenarioTotalCost;

    // Break-even analysis - months until total savings offset loan origination fee
    const breakEvenMonths =
      originationFee > 0 ? Math.ceil(originationFee / (totalInterestSavings / loan.term)) : 0;

    return {
      loan,
      selectedDebts: debtComparisons,
      originationFee,
      totalLoanAmount,
      monthlyLoanPayment,
      totalLoanInterest,
      totalLoanCost,
      currentScenarioTotalInterest,
      currentScenarioTotalCost,
      loanScenarioTotalInterest,
      loanScenarioTotalCost,
      totalInterestSavings,
      totalCostSavings,
      breakEvenMonths,
    };
  }
}
