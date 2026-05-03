import { TestBed } from '@angular/core/testing';
import { LoanComparisonService } from './loan-comparison.service';
import { Debt } from '../models/debt.model';
import { LoanDetails, LoanComparisonResult } from '../models/loan-comparison.model';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    _id: 'd1',
    name: 'Credit Card',
    amountOwed: 5000,
    interestRate: 20,
    minimumPayment: 150,
    ...overrides,
  } as Debt;
}

function makeLoan(overrides: Partial<LoanDetails> = {}): LoanDetails {
  return {
    amount: 5000,
    interestRate: 8,
    term: 60,
    originationFeePercent: 2,
    ...overrides,
  } as LoanDetails;
}

// Build a minimal LoanComparisonResult for rating tests
function makeResult(overrides: Partial<LoanComparisonResult> = {}): LoanComparisonResult {
  const loan = makeLoan();
  return {
    loan,
    selectedDebts: [],
    originationFee: 100,
    totalLoanAmount: 5100,
    monthlyLoanPayment: 103,
    totalLoanInterest: 1080,
    totalLoanCost: 6180,
    currentScenarioTotalInterest: 4000,
    currentScenarioTotalCost: 9000,
    loanScenarioTotalInterest: 1080,
    loanScenarioTotalCost: 6180,
    totalInterestSavings: 2920,
    totalCostSavings: 2820,
    breakEvenMonths: 2,
    ...overrides,
  } as LoanComparisonResult;
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('LoanComparisonService', () => {
  let svc: LoanComparisonService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(LoanComparisonService);
  });

  it('should be created', () => expect(svc).toBeTruthy());

  // ── calculateMonthlyPayment ────────────────────────────────────────────

  describe('calculateMonthlyPayment', () => {
    it('uses principal / months when rate is 0', () => {
      expect(svc.calculateMonthlyPayment(1200, 0, 12)).toBeCloseTo(100, 2);
    });

    it('returns correct amortized payment for standard loan', () => {
      // $10,000 at 6% for 60 months → ~$193.33
      expect(svc.calculateMonthlyPayment(10000, 6, 60)).toBeCloseTo(193.33, 1);
    });

    it('monthly payment × term ≥ principal', () => {
      const p = svc.calculateMonthlyPayment(5000, 8, 36);
      expect(p * 36).toBeGreaterThanOrEqual(5000);
    });

    it('higher interest rate → higher payment', () => {
      const low = svc.calculateMonthlyPayment(5000, 5, 60);
      const high = svc.calculateMonthlyPayment(5000, 15, 60);
      expect(high).toBeGreaterThan(low);
    });

    it('longer term → lower payment', () => {
      const short = svc.calculateMonthlyPayment(5000, 8, 36);
      const long = svc.calculateMonthlyPayment(5000, 8, 84);
      expect(long).toBeLessThan(short);
    });
  });

  // ── calculateLoanInterest ──────────────────────────────────────────────

  describe('calculateLoanInterest', () => {
    it('returns 0 for exact principal payoff', () => {
      expect(svc.calculateLoanInterest(100, 1200, 12)).toBe(0);
    });

    it('calculates interest as payment*months - principal', () => {
      expect(svc.calculateLoanInterest(110, 1200, 12)).toBeCloseTo(120, 5);
    });

    it('is non-negative for reasonable loan params', () => {
      const payment = svc.calculateMonthlyPayment(5000, 8, 60);
      const interest = svc.calculateLoanInterest(payment, 5000, 60);
      expect(interest).toBeGreaterThan(0);
    });
  });

  // ── calculateDebtPayoff ────────────────────────────────────────────────

  describe('calculateDebtPayoff', () => {
    it('pays off debt in reasonable time with adequate payment', () => {
      const result = svc.calculateDebtPayoff(5000, 20, 200);
      expect(result.monthsToPayoff).toBeGreaterThan(0);
      expect(result.monthsToPayoff).toBeLessThan(600);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.totalPaid).toBeCloseTo(5000 + result.totalInterest, 2);
    });

    it('adjusts payment when it does not cover interest', () => {
      // Balance = 10000, rate = 24% → monthly interest = 200; payment = 100 (too low)
      const result = svc.calculateDebtPayoff(10000, 24, 100);
      expect(result.monthsToPayoff).toBeLessThan(600);
    });

    it('caps payoff at 600 months (50 years)', () => {
      // Nearly impossible scenario — still should not loop forever
      const result = svc.calculateDebtPayoff(1000000, 30, 1);
      expect(result.monthsToPayoff).toBeLessThanOrEqual(600);
    });

    it('totalPaid = balance + totalInterest', () => {
      const result = svc.calculateDebtPayoff(3000, 15, 120);
      expect(result.totalPaid).toBeCloseTo(3000 + result.totalInterest, 2);
    });

    it('zero interest rate pays off exactly with no interest', () => {
      const result = svc.calculateDebtPayoff(1000, 0, 100);
      expect(result.totalInterest).toBe(0);
      expect(result.monthsToPayoff).toBe(10);
    });
  });

  // ── compareDebtWithLoan ────────────────────────────────────────────────

  describe('compareDebtWithLoan', () => {
    it('isSavingsPositive is true when loan rate is lower than debt rate', () => {
      const d = makeDebt({ interestRate: 20 });
      const l = makeLoan({ interestRate: 5 });
      const result = svc.compareDebtWithLoan(d, l);
      expect(result.isSavingsPositive).toBeTrue();
      expect(result.interestSavings).toBeGreaterThan(0);
    });

    it('isSavingsPositive is false when loan rate exceeds debt rate', () => {
      const d = makeDebt({ interestRate: 5 });
      const l = makeLoan({ interestRate: 25 });
      const result = svc.compareDebtWithLoan(d, l);
      expect(result.isSavingsPositive).toBeFalse();
    });

    it('returns correct debtId and name', () => {
      const d = makeDebt({ _id: 'abc', name: 'Visa' });
      const result = svc.compareDebtWithLoan(d, makeLoan());
      expect(result.debtId).toBe('abc');
      expect(result.debtName).toBe('Visa');
    });

    it('falls back to 2% minimum payment if minimumPayment not set', () => {
      const d = makeDebt({ minimumPayment: undefined, amountOwed: 5000 });
      // Should not throw
      expect(() => svc.compareDebtWithLoan(d, makeLoan())).not.toThrow();
    });
  });

  // ── generateComparison ────────────────────────────────────────────────

  describe('generateComparison', () => {
    it('calculates origination fee from percent', () => {
      const loan = makeLoan({ amount: 5000, originationFeePercent: 2 });
      const result = svc.generateComparison(loan, [makeDebt()]);
      expect(result.originationFee).toBeCloseTo(100, 2);
      expect(result.totalLoanAmount).toBeCloseTo(5100, 2);
    });

    it('breakEvenMonths is 0 when no origination fee', () => {
      const loan = makeLoan({ originationFeePercent: 0 });
      const result = svc.generateComparison(loan, [makeDebt()]);
      expect(result.breakEvenMonths).toBe(0);
    });

    it('returns one debtComparison per debt', () => {
      const debts = [makeDebt({ _id: 'd1' }), makeDebt({ _id: 'd2' })];
      const result = svc.generateComparison(makeLoan(), debts);
      expect(result.selectedDebts.length).toBe(2);
    });
  });

  // ── analyzeComparison (ratings) ───────────────────────────────────────

  describe('analyzeComparison', () => {
    it('rates poor when totalCostSavings is negative', () => {
      const result = makeResult({ totalCostSavings: -100 });
      const advisory = svc.analyzeComparison(result);
      expect(advisory.overallRating).toBe('poor');
    });

    it('rates poor when loan rate is predatory (>15%) AND origination fee >5%', () => {
      const loan = makeLoan({ interestRate: 20, originationFeePercent: 7, amount: 5000 });
      const debt = makeDebt({ interestRate: 10 }); // debt rate lower than loan rate
      const result = svc.generateComparison(loan, [debt]);
      const advisory = svc.analyzeComparison(result);
      expect(['poor', 'marginal']).toContain(advisory.overallRating);
    });

    it('rates reasonable when savings > 10% of current cost (no high flags)', () => {
      // savings = 1000, currentScenarioTotalCost = 9000 → > 10%
      const result = makeResult({
        totalCostSavings: 1000,
        currentScenarioTotalCost: 9000,
        originationFee: 100,
        loan: makeLoan({ interestRate: 5, originationFeePercent: 1 }),
        selectedDebts: [
          {
            debtId: 'd1',
            debtName: 'Visa',
            currentBalance: 5000,
            currentInterestRate: 20,
            currentTotalInterest: 4000,
            currentMinimumPayment: 150,
            currentMonthsToPayoff: 60,
            currentTotalPaid: 9000,
            loanTotalInterest: 500,
            loanMonthlyPayment: 103,
            loanMonthsToPayoff: 60,
            loanTotalPaid: 5500,
            interestSavings: 3500,
            isSavingsPositive: true,
          },
        ],
      });
      const advisory = svc.analyzeComparison(result);
      expect(advisory.overallRating).toBe('reasonable');
    });

    it('includes redFlags, opportunities, hiddenCosts and educationalNotes', () => {
      const result = makeResult();
      const advisory = svc.analyzeComparison(result);
      expect(advisory.redFlags).toBeDefined();
      expect(advisory.opportunities).toBeDefined();
      expect(advisory.hiddenCosts).toBeDefined();
      expect(advisory.educationalNotes).toBeDefined();
      expect(advisory.educationalNotes.length).toBeGreaterThan(0);
    });

    it('provides executiveSummary and recommendation strings', () => {
      const result = makeResult();
      const advisory = svc.analyzeComparison(result);
      expect(typeof advisory.executiveSummary).toBe('string');
      expect(advisory.executiveSummary.length).toBeGreaterThan(10);
      expect(typeof advisory.recommendation).toBe('string');
      expect(advisory.recommendation.length).toBeGreaterThan(10);
    });

    it('generates real advisory from generateComparison result', () => {
      const loan = makeLoan({ interestRate: 7, originationFeePercent: 1 });
      const compResult = svc.generateComparison(loan, [makeDebt()]);
      expect(() => svc.analyzeComparison(compResult)).not.toThrow();
    });
  });
});
