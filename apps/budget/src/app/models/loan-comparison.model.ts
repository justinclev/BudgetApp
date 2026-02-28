export interface LoanDetails {
  amount: number;
  interestRate: number; // Annual percentage rate
  term: number; // Months
  originationFeePercent: number; // As percentage (e.g., 2.5 for 2.5%)
}

export interface LoanDebtComparison {
  debtId: string;
  debtName: string;
  currentBalance: number;
  currentInterestRate: number;

  // Current scenario (without loan)
  currentTotalInterest: number;
  currentMinimumPayment: number;
  currentMonthsToPayoff: number;
  currentTotalPaid: number;

  // Loan scenario (pay off with new loan)
  loanTotalInterest: number;
  loanMonthlyPayment: number;
  loanMonthsToPayoff: number;
  loanTotalPaid: number;

  // Savings
  interestSavings: number;
  isSavingsPositive: boolean;
}

export interface LoanComparisonResult {
  loan: LoanDetails;
  selectedDebts: LoanDebtComparison[];

  // Loan details
  originationFee: number;
  totalLoanAmount: number; // Amount + origination fee
  monthlyLoanPayment: number;
  totalLoanInterest: number;
  totalLoanCost: number; // Principal + interest + fees

  // Combined totals
  currentScenarioTotalInterest: number;
  currentScenarioTotalCost: number;

  loanScenarioTotalInterest: number;
  loanScenarioTotalCost: number;

  // Overall savings
  totalInterestSavings: number;
  totalCostSavings: number;
  breakEvenMonths: number;
}
