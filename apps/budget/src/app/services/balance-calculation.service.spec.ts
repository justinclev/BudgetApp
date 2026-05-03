import { TestBed } from '@angular/core/testing';
import { BalanceCalculationService } from './balance-calculation.service';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';
import { RecurringTransaction } from '../models/recurring-transaction.model';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    _id: 't1',
    description: 'Test',
    amount: 100,
    date: '2024-01-15',
    type: 'Recurring',
    ...overrides,
  } as Transaction;
}

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    _id: 'd1',
    name: 'Credit Card',
    amountOwed: 1000,
    interestRate: 12,
    minimumPayment: 50,
    ...overrides,
  } as Debt;
}

function rt(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    _id: 'rt1',
    name: 'CC Payment',
    amount: 100,
    type: 'Recurring',
    frequency: 'Monthly',
    linkedDebtId: 'd1',
    ...overrides,
  } as RecurringTransaction;
}

describe('BalanceCalculationService', () => {
  let svc: BalanceCalculationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(BalanceCalculationService);
  });

  it('should be created', () => expect(svc).toBeTruthy());

  // ── Running balance ────────────────────────────────────────────────────

  it('adds income to running balance', () => {
    const transactions = [tx({ type: 'Income', amount: 500 })];
    svc.calculateBalances(transactions, [], [], 1000);
    expect(transactions[0].balances?.BalancePrior).toBe(1000);
    expect(transactions[0].balances?.BalanceAfter).toBe(1500);
  });

  it('subtracts expense from running balance', () => {
    const transactions = [tx({ type: 'Recurring', amount: 200 })];
    svc.calculateBalances(transactions, [], [], 1000);
    expect(transactions[0].balances?.BalancePrior).toBe(1000);
    expect(transactions[0].balances?.BalanceAfter).toBe(800);
  });

  it('chains multiple transactions correctly', () => {
    const transactions = [
      tx({ _id: 't1', type: 'Income', amount: 500 }),
      tx({ _id: 't2', type: 'Recurring', amount: 300 }),
      tx({ _id: 't3', type: 'Income', amount: 100 }),
    ];
    svc.calculateBalances(transactions, [], [], 0);
    expect(transactions[0].balances?.BalanceAfter).toBe(500);
    expect(transactions[1].balances?.BalanceAfter).toBe(200);
    expect(transactions[2].balances?.BalanceAfter).toBe(300);
  });

  it('starts from the provided initial balance', () => {
    const transactions = [tx({ type: 'Recurring', amount: 100 })];
    svc.calculateBalances(transactions, [], [], 250);
    expect(transactions[0].balances?.BalancePrior).toBe(250);
    expect(transactions[0].balances?.BalanceAfter).toBe(150);
  });

  // ── Debt balance ───────────────────────────────────────────────────────

  it('reduces debt balance by payment amount', () => {
    const transactions = [tx({ referenceId: 'rt1', amount: 100 })];
    svc.calculateBalances(transactions, [debt()], [rt()], 0);
    // Debt = 1000 - 100 = 900, then interest = 900 * (12/100/12) = 9 → 909
    expect(transactions[0].balances?.DebtBalancePrior).toBe(1000);
    expect(transactions[0].balances?.DebtBalanceAfter).toBeCloseTo(909, 2);
  });

  it('applies 0% interest correctly (no interest charge)', () => {
    const transactions = [tx({ referenceId: 'rt1', amount: 100 })];
    svc.calculateBalances(transactions, [debt({ interestRate: 0 })], [rt()], 0);
    expect(transactions[0].balances?.DebtBalanceAfter).toBe(900);
  });

  it('does not apply interest when debt reaches zero', () => {
    const transactions = [tx({ referenceId: 'rt1', amount: 1000 })];
    svc.calculateBalances(transactions, [debt({ amountOwed: 1000 })], [rt()], 0);
    expect(transactions[0].balances?.DebtBalanceAfter).toBe(0);
  });

  it('does not apply interest when debt goes negative (overpayment)', () => {
    const transactions = [tx({ referenceId: 'rt1', amount: 1500 })];
    svc.calculateBalances(transactions, [debt({ amountOwed: 1000 })], [rt()], 0);
    // debtBalance < 0, so no interest
    expect(transactions[0].balances?.DebtBalanceAfter).toBeLessThanOrEqual(0);
  });

  it('leaves DebtBalancePrior and DebtBalanceAfter undefined for unlinked transactions', () => {
    const transactions = [tx({ referenceId: undefined })];
    svc.calculateBalances(transactions, [debt()], [rt()], 0);
    expect(transactions[0].balances?.DebtBalancePrior).toBeUndefined();
    expect(transactions[0].balances?.DebtBalanceAfter).toBeUndefined();
  });

  it('leaves debt balances undefined when recurring transaction has no linkedDebtId', () => {
    const transactions = [tx({ referenceId: 'rt1' })];
    svc.calculateBalances(transactions, [debt()], [rt({ linkedDebtId: undefined })], 0);
    expect(transactions[0].balances?.DebtBalancePrior).toBeUndefined();
    expect(transactions[0].balances?.DebtBalanceAfter).toBeUndefined();
  });

  it('carries updated debt balance across consecutive payments', () => {
    const transactions = [
      tx({ _id: 't1', referenceId: 'rt1', amount: 100, type: 'Recurring' }),
      tx({ _id: 't2', referenceId: 'rt1', amount: 100, type: 'Recurring' }),
    ];
    svc.calculateBalances(transactions, [debt({ interestRate: 0 })], [rt()], 0);
    // First payment: 1000 - 100 = 900
    expect(transactions[0].balances?.DebtBalanceAfter).toBe(900);
    // Second payment: 900 - 100 = 800
    expect(transactions[1].balances?.DebtBalancePrior).toBe(900);
    expect(transactions[1].balances?.DebtBalanceAfter).toBe(800);
  });

  it('handles empty transaction array without throwing', () => {
    expect(() => svc.calculateBalances([], [debt()], [rt()], 500)).not.toThrow();
  });

  it('handles debt with no _id (skips initializing that debt)', () => {
    const transactions = [tx({ referenceId: 'rt1', amount: 100 })];
    const debtNoId = { ...debt(), _id: undefined } as unknown as Debt;
    svc.calculateBalances(transactions, [debtNoId], [rt()], 0);
    // linked debt not found, so no debt balances set
    expect(transactions[0].balances?.DebtBalancePrior).toBeUndefined();
  });
});
