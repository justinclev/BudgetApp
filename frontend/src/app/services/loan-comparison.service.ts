import { Injectable } from '@angular/core';
import { Debt } from '../models/debt.model';
import {
  LoanDetails,
  LoanComparisonResult,
  LoanDebtComparison,
} from '../models/loan-comparison.model';
import { FinancialAdvisory, AdvisoryInsight } from '../models/loan-advisory.model';

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
  calculateDebtPayoff(
    balance: number,
    annualInterestRate: number,
    monthlyPayment: number,
  ): {
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
  compareDebtWithLoan(debt: Debt, loan: LoanDetails): LoanDebtComparison {
    const debtId = debt._id || '';
    const debtBalance = debt.amountOwed || 0;
    const debtRate = debt.interestRate || 0;

    // Current scenario - use the debt's minimum payment from record
    const minimumPayment = debt.minimumPayment || debtBalance * 0.02; // Fall back to 2% if not set
    const currentPayoff = this.calculateDebtPayoff(debtBalance, debtRate, minimumPayment);

    // Loan scenario - pay off debt with loan
    const loanMonthlyPayment = this.calculateMonthlyPayment(
      debtBalance,
      loan.interestRate,
      loan.term,
    );
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
  generateComparison(loan: LoanDetails, selectedDebts: Debt[]): LoanComparisonResult {
    // Calculate origination fee
    const originationFee = (loan.amount * loan.originationFeePercent) / 100;
    const totalLoanAmount = loan.amount + originationFee;

    // Calculate loan payment
    const monthlyLoanPayment = this.calculateMonthlyPayment(
      totalLoanAmount,
      loan.interestRate,
      loan.term,
    );
    const totalLoanInterest = this.calculateLoanInterest(
      monthlyLoanPayment,
      totalLoanAmount,
      loan.term,
    );
    const totalLoanCost = totalLoanAmount + totalLoanInterest;

    // Compare each debt
    const debtComparisons = selectedDebts.map((debt) => this.compareDebtWithLoan(debt, loan));

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
    const loanScenarioTotalCost =
      debtComparisons.reduce((sum, comparison) => sum + comparison.loanTotalPaid, 0) +
      totalLoanInterest +
      originationFee;

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

  /**
   * Generate financial advisory analysis for the loan comparison
   * Identifies red flags, hidden costs, and provides education about lending practices
   */
  analyzeComparison(result: LoanComparisonResult): FinancialAdvisory {
    const redFlags: AdvisoryInsight[] = [];
    const opportunities: AdvisoryInsight[] = [];
    const hiddenCosts: AdvisoryInsight[] = [];

    // 1. ORIGINATION FEE ANALYSIS
    const originationFeePercent = (result.originationFee / result.loan.amount) * 100;
    if (originationFeePercent > 5) {
      redFlags.push({
        type: 'warning',
        title: 'High Origination Fee',
        description: `Your origination fee is ${originationFeePercent.toFixed(2)}% (${this.formatCurrency(result.originationFee)}). Industry standard is 1-3%. This is a predatory lending tactic to extract upfront profit from borrowers.`,
        impact: 'high',
      });
    } else if (originationFeePercent > 3) {
      redFlags.push({
        type: 'alert',
        title: 'Above-Average Origination Fee',
        description: `Your origination fee is ${originationFeePercent.toFixed(2)}% (${this.formatCurrency(result.originationFee)}). Consider negotiating this down or shopping around.`,
        impact: 'medium',
      });
    }

    // 2. BREAKEVEN ANALYSIS - Is the fee worth it?
    if (result.breakEvenMonths > result.loan.term * 0.8) {
      redFlags.push({
        type: 'warning',
        title: 'Poor Break-Even Timeline',
        description: `The origination fee ($${result.originationFee.toFixed(2)}) takes ${result.breakEvenMonths} months to break even. You only have ${result.loan.term} months total. If you pay off early or refinance again, you lose money.`,
        impact: 'high',
      });
    } else if (result.breakEvenMonths > result.loan.term * 0.6) {
      redFlags.push({
        type: 'alert',
        title: 'Extended Break-Even Period',
        description: `Takes ${result.breakEvenMonths} of ${result.loan.term} months (${((result.breakEvenMonths / result.loan.term) * 100).toFixed(0)}%) to break even on fees alone.`,
        impact: 'medium',
      });
    }

    // 3. INTEREST RATE ANALYSIS
    if (result.loan.interestRate > 15) {
      redFlags.push({
        type: 'warning',
        title: 'Extremely High Interest Rate',
        description: `An interest rate of ${result.loan.interestRate.toFixed(2)}% is predatory lending. This rate is typically reserved for those with severely damaged credit. Shop aggressively for better rates.`,
        impact: 'high',
      });
    } else if (result.loan.interestRate > 10) {
      redFlags.push({
        type: 'alert',
        title: 'High Interest Rate',
        description: `${result.loan.interestRate.toFixed(2)}% is above prime lending rates. You may qualify for better terms elsewhere.`,
        impact: 'high',
      });
    }

    // 4. TOTAL COST ANALYSIS
    if (result.totalCostSavings < 0) {
      redFlags.push({
        type: 'warning',
        title: 'No Actual Savings',
        description: `This loan will COST you ${this.formatCurrency(Math.abs(result.totalCostSavings))} more than paying current debts. This is a net loss. Do NOT take this loan.`,
        impact: 'high',
      });
    } else if (result.totalCostSavings < result.originationFee * 1.5) {
      redFlags.push({
        type: 'alert',
        title: 'Minimal Savings After Fees',
        description: `Your total savings of ${this.formatCurrency(result.totalCostSavings)} is barely above the origination fee. The margin is too thin - one missed payment or rate change could eliminate savings.`,
        impact: 'medium',
      });
    } else {
      opportunities.push({
        type: 'positive',
        title: 'Meaningful Savings Potential',
        description: `You could save ${this.formatCurrency(result.totalCostSavings)} after all fees. This represents ${((result.totalCostSavings / result.currentScenarioTotalCost) * 100).toFixed(1)}% reduction in total cost.`,
        impact: 'high',
      });
    }

    // 5. MONTHLY PAYMENT ANALYSIS
    const totalCurrentPayments = result.selectedDebts.reduce(
      (sum, d) => sum + d.currentMinimumPayment,
      0,
    );
    const paymentIncrease = result.monthlyLoanPayment - totalCurrentPayments;
    if (paymentIncrease > totalCurrentPayments * 0.25) {
      redFlags.push({
        type: 'alert',
        title: 'Significant Payment Increase',
        description: `Monthly payment increases from ${this.formatCurrency(totalCurrentPayments)} to ${this.formatCurrency(result.monthlyLoanPayment)} (+${this.formatCurrency(paymentIncrease)}). Ensure you can afford this long-term.`,
        impact: 'medium',
      });
    }

    // 6. HIDDEN COSTS - What they don't tell you
    hiddenCosts.push({
      type: 'info',
      title: 'APR vs Interest Rate',
      description: `The advertised rate is often just the interest rate. The APR (Annual Percentage Rate) includes fees spread over time. Your true cost is typically 0.5-2% higher than quoted.`,
      impact: 'medium',
    });

    hiddenCosts.push({
      type: 'info',
      title: 'Prepayment Penalties',
      description: `Many loans charge prepayment penalties to prevent early payoff. Read the fine print. If you pay off early, you could lose your savings advantage.`,
      impact: 'medium',
    });

    hiddenCosts.push({
      type: 'info',
      title: 'Loan Guarantees & Insurance',
      description: `Lenders often bundle credit insurance or other products into loans, increasing total cost. These are optional - refuse them during application.`,
      impact: 'low',
    });

    // 7. INDIVIDUAL DEBT ANALYSIS
    const negativeDeals = result.selectedDebts.filter((d) => !d.isSavingsPositive);
    if (negativeDeals.length > 0) {
      redFlags.push({
        type: 'alert',
        title: `${negativeDeals.length} Debts Won't Benefit`,
        description: `${negativeDeals.map((d) => d.debtName).join(', ')} would cost MORE under the new loan than current payments. Selectively keep these debts, refinance only the profitable ones.`,
        impact: 'medium',
      });
    }

    // 8. TERM LENGTH ANALYSIS
    if (result.loan.term > 84) {
      redFlags.push({
        type: 'alert',
        title: 'Extended Loan Term',
        description: `A ${result.loan.term}-month term (${(result.loan.term / 12).toFixed(1)} years) extends your debt obligation far into the future. Even with lower rates, longer terms = more total interest paid.`,
        impact: 'medium',
      });
    }

    // BUILD OVERALL RATING AND RECOMMENDATION
    const highImpactRedFlags = redFlags.filter((f) => f.impact === 'high').length;
    let overallRating: 'poor' | 'fair' | 'marginal' | 'reasonable' | 'good' = 'fair';
    let ratingExplanation = '';

    if (result.totalCostSavings < 0) {
      overallRating = 'poor';
      ratingExplanation = 'This loan costs more than current situation. Reject.';
    } else if (highImpactRedFlags >= 2) {
      overallRating = 'poor';
      ratingExplanation =
        'Multiple high-impact risks detected. This appears to be predatory lending.';
    } else if (highImpactRedFlags === 1) {
      overallRating = 'marginal';
      ratingExplanation = 'Significant risks exist. Proceed with extreme caution.';
    } else if (result.totalCostSavings < result.originationFee * 2) {
      overallRating = 'fair';
      ratingExplanation =
        'Minimal benefit after fees. Only proceed if rates/payments significantly improve your situation.';
    } else if (result.totalCostSavings > result.currentScenarioTotalCost * 0.1) {
      overallRating = 'reasonable';
      ratingExplanation =
        'Solid savings opportunity with manageable risks. This could be a good refinancing option.';
    } else {
      overallRating = 'good';
      ratingExplanation =
        'Strong savings with acceptable terms. This appears to be a legitimate refinancing opportunity.';
    }

    const executiveSummary = this.generateExecutiveSummary(result, overallRating);
    const recommendation = this.generateRecommendation(result, overallRating, redFlags);
    const educationalNotes = this.generateEducationalNotes(result);

    return {
      overallRating,
      ratingExplanation,
      redFlags,
      opportunities,
      hiddenCosts,
      executiveSummary,
      recommendation,
      educationalNotes,
    };
  }

  private generateExecutiveSummary(result: LoanComparisonResult, rating: string): string {
    const savings = result.totalCostSavings;
    const savingsPercent = ((savings / result.currentScenarioTotalCost) * 100).toFixed(1);
    const payoff =
      result.selectedDebts.reduce((sum, d) => sum + d.currentMonthsToPayoff, 0) /
      result.selectedDebts.length;
    const newPayoff = result.loan.term;

    return `${rating.toUpperCase()} DEAL: Taking this loan would ${savings > 0 ? 'save' : 'cost'} you ${this.formatCurrency(Math.abs(savings))} (${Math.abs(Number(savingsPercent))}% ${savings > 0 ? 'reduction' : 'increase'}) over the life of your debt. Current average payoff time: ${payoff.toFixed(0)} months. New payoff time: ${newPayoff} months. Origination fee: ${this.formatCurrency(result.originationFee)}.`;
  }

  private generateRecommendation(
    result: LoanComparisonResult,
    rating: string,
    redFlags: AdvisoryInsight[],
  ): string {
    if (rating === 'poor') {
      return '❌ REJECT THIS LOAN. The costs exceed any benefits. This lender is trying to profit from your situation. Look for legitimate financial institutions or seek credit counseling.';
    }

    if (rating === 'marginal') {
      return '⚠️ PROCEED WITH EXTREME CAUTION. Significant red flags exist. Before accepting: (1) Negotiate lower fees/rates, (2) Get competing offers in writing, (3) Read all fine print for prepayment penalties, (4) Verify no hidden charges will be added at closing.';
    }

    if (rating === 'fair') {
      return '➖ CONDITIONAL - Could be worth it IF: (1) You commit to not accumulating new debt, (2) You can afford the new payment comfortably, (3) You do NOT plan to refinance again soon (break-even risk), (4) You verify all advertised terms match closing documents.';
    }

    if (rating === 'reasonable') {
      return '✓ VIABLE OPTION. This refinancing could meaningfully improve your financial situation. Before accepting: (1) Compare with at least 2-3 other lenders, (2) Confirm no prepayment penalties exist, (3) Ensure the rate is locked in writing, (4) Budget strictly to take advantage of payment savings.';
    }

    return '✓✓ STRONG OPPORTUNITY. This appears to be a legitimate refinancing with solid savings. Still verify: (1) APR matches stated rate, (2) All fees are disclosed upfront, (3) No prepayment penalties, (4) Rate lock is documented, (5) Closing costs are reasonable.';
  }

  private generateEducationalNotes(result: LoanComparisonResult): string[] {
    return [
      '📚 CORPORATE LENDING TACTICS: Lenders use origination fees to front-load profits. Even if you pay off early, they keep the fee. This incentivizes predatory lending.',
      '📚 APR DECEPTION: Interest rates advertised (e.g., "8%") are often NOT the true cost. APR includes fees, resulting in 0.5-2% higher effective rate. Always ask for APR, not just the rate.',
      '📚 EXTENDED TERMS = MORE PROFIT: 84-month loans seem affordable ($X/month) but you pay dramatically more interest. A 60-month vs 84-month loan at same rate can mean $1,000+ more in interest.',
      '📚 BREAK-EVEN TRAPS: If origination fee break-even is near the loan term end, you cannot refinance without losing money. This traps you with high rates.',
      '📚 PREPAYMENT PENALTIES: Many loans penalize early payoff. This prevents you from benefiting from rate decreases or financial windfalls. Always negotiate removal of prepayment penalties.',
      '📚 CREDIT PULLS: Each loan application triggers a "hard inquiry" damaging your credit 5-10 points. Multiple applications in 2 weeks count as one, but spread them out and your score drops further.',
      '📚 DEBT SPIRAL: If you refinance but DON\'T change behavior, you\'ll end up with old debt + new loan. Never "free up" old credit to spend again - close those accounts after payoff.',
      `📚 YOUR SITUATION: You currently pay ${this.formatCurrency(result.selectedDebts.reduce((sum, d) => sum + d.currentTotalInterest, 0))} in interest across ${result.selectedDebts.length} accounts. Consolidation can help, but only if you commit to no new debt.`,
    ];
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
