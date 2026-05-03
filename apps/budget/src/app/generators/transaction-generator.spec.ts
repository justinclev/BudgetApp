import { TransactionGenerator } from './transaction-generator';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';
import { TransactionService } from '../services/transaction.service';
import { of } from 'rxjs';

// ── Helpers ────────────────────────────────────────────────────────────────

function d(dateStr: string): Date {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

function rt(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    _id: 'rt1',
    name: 'Rent',
    amount: 1000,
    type: 'expense',
    frequency: 'Monthly',
    startingDate: d('2024-01-01'),
    ...overrides,
  } as RecurringTransaction;
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    _id: 't1',
    name: 'Rent',
    amount: 1000,
    date: d('2024-01-01'),
    type: 'Recurring',
    referenceId: 'rt1',
    ...overrides,
  } as Transaction;
}

function mockTransactionService(existing: Transaction[] = []): jasmine.SpyObj<TransactionService> {
  const svc = jasmine.createSpyObj<TransactionService>('TransactionService', [
    'getTransactions',
    'saveTransactions',
  ]);
  svc.getTransactions.and.returnValue(of(existing));
  svc.saveTransactions.and.returnValue(of(existing));
  return svc;
}

function makeGenerator(
  rts: RecurringTransaction[] = [],
  debts: Debt[] = [],
  existing: Transaction[] = [],
): TransactionGenerator {
  return new TransactionGenerator(rts, debts, mockTransactionService(existing));
}

// ── getNextDate (private — accessed via cast) ──────────────────────────────

describe('TransactionGenerator.getNextDate', () => {
  let gen: TransactionGenerator;

  beforeEach(() => {
    gen = makeGenerator();
  });

  function next(date: Date, freq: string): Date {
    return (gen as any).getNextDate(date, freq);
  }

  it('Daily adds 1 day', () => {
    const result = next(d('2024-01-01'), 'Daily');
    expect(result.toDateString()).toBe(d('2024-01-02').toDateString());
  });

  it('Weekly adds 7 days', () => {
    expect(next(d('2024-01-01'), 'Weekly').toDateString()).toBe(d('2024-01-08').toDateString());
  });

  it('Bi-Weekly adds 14 days', () => {
    expect(next(d('2024-01-01'), 'Bi-Weekly').toDateString()).toBe(d('2024-01-15').toDateString());
  });

  describe('Semi-Monthly', () => {
    it('advances from day <15 to day 15 of same month', () => {
      expect(next(d('2024-01-01'), 'Semi-Monthly').toDateString()).toBe(
        d('2024-01-15').toDateString(),
      );
    });

    it('advances from day 15 to 1st of next month', () => {
      expect(next(d('2024-01-15'), 'Semi-Monthly').toDateString()).toBe(
        d('2024-02-01').toDateString(),
      );
    });

    it('advances from day >15 to 1st of next month', () => {
      expect(next(d('2024-01-20'), 'Semi-Monthly').toDateString()).toBe(
        d('2024-02-01').toDateString(),
      );
    });
  });

  it('Monthly advances 1 month', () => {
    // Use a day that exists in every month to avoid date overflow
    expect(next(d('2024-01-15'), 'Monthly').getMonth()).toBe(1); // February
  });

  it('Annually advances 1 year', () => {
    const result = next(d('2024-01-01'), 'Annually');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('unknown frequency advances by 1 day (prevents infinite loop)', () => {
    const result = next(d('2024-01-15'), 'Unknown');
    expect(result.toDateString()).toBe(d('2024-01-16').toDateString());
  });
});

// ── deleteRelevantTransactions ─────────────────────────────────────────────

describe('TransactionGenerator.deleteRelevantTransactions', () => {
  let gen: TransactionGenerator;

  beforeEach(() => {
    gen = makeGenerator();
  });

  function del(existing: Transaction[], id: string): Transaction[] {
    return (gen as any).deleteRelevantTransactions(existing, id);
  }

  it('returns empty array when id is empty string (delete all)', () => {
    const existing = [tx({ referenceId: 'rt1' }), tx({ _id: 't2', referenceId: 'rt2' })];
    expect(del(existing, '')).toEqual([]);
  });

  it('filters only matching referenceId when id is provided', () => {
    const keep = tx({ _id: 't2', referenceId: 'rt2' });
    const remove = tx({ _id: 't1', referenceId: 'rt1' });
    const result = del([keep, remove], 'rt1');
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe('t2');
  });

  it('returns all transactions unchanged when no match', () => {
    const existing = [tx({ referenceId: 'rt2' })];
    expect(del(existing, 'rt999')).toEqual(existing);
  });

  it('returns empty array when input is empty', () => {
    expect(del([], 'rt1')).toEqual([]);
  });
});

// ── mergeWithoutReplacement ────────────────────────────────────────────────

describe('TransactionGenerator.mergeWithoutReplacement', () => {
  let gen: TransactionGenerator;

  beforeEach(() => {
    gen = makeGenerator();
  });

  function merge(existing: Transaction[], generated: Transaction[]): Transaction[] {
    return (gen as any).mergeWithoutReplacement(existing, generated);
  }

  it('adds new generated transactions not in existing', () => {
    const existing = [tx({ referenceId: 'rt1', date: d('2024-01-01') })];
    const newTx = tx({ _id: 't2', referenceId: 'rt1', date: d('2024-02-01') });
    const result = merge(existing, [newTx]);
    expect(result.length).toBe(2);
  });

  it('skips generated transactions that duplicate existing by referenceId+date', () => {
    const existingTx = tx({ referenceId: 'rt1', date: d('2024-01-01') });
    const dupGenerated = tx({ referenceId: 'rt1', date: d('2024-01-01') });
    const result = merge([existingTx], [dupGenerated]);
    expect(result.length).toBe(1);
  });

  it('result is sorted ascending by date', () => {
    const early = tx({ _id: 'e', referenceId: 'rt1', date: d('2024-03-01') });
    const late = tx({ _id: 'l', referenceId: 'rt2', date: d('2024-01-01') });
    const result = merge([early], [late]);
    expect(result[0].date.getTime()).toBeLessThanOrEqual(result[1].date.getTime());
  });

  it('handles empty existing array', () => {
    const gen_tx = tx({ referenceId: 'rt1', date: d('2024-01-15') });
    expect(merge([], [gen_tx]).length).toBe(1);
  });

  it('handles empty generated array', () => {
    const e = tx();
    expect(merge([e], []).length).toBe(1);
  });
});

// ── Generate (integration) ────────────────────────────────────────────────

describe('TransactionGenerator.Generate', () => {
  it('generates monthly transactions for a 3-month range', async () => {
    const recurring = [rt({ frequency: 'Monthly', startingDate: d('2024-01-01') })];
    const svcSpy = mockTransactionService([]);
    const generator = new TransactionGenerator(recurring, [], svcSpy);

    await generator.Generate(d('2024-01-01'), d('2024-03-31'), 0);

    expect(generator.transactions.length).toBe(3);
    expect(svcSpy.saveTransactions).toHaveBeenCalledTimes(1);
  });

  it('replaces all when replace=true and id is empty', async () => {
    const existing = [tx({ _id: 'old', referenceId: 'rt1', date: d('2023-12-01') })];
    const recurring = [rt({ frequency: 'Monthly', startingDate: d('2024-01-01') })];
    const svcSpy = mockTransactionService(existing);
    const generator = new TransactionGenerator(recurring, [], svcSpy);

    await generator.Generate(d('2024-01-01'), d('2024-01-31'), 0, '', true);
    // Old transaction outside date range is deleted (replace all), 1 new one generated
    expect(generator.transactions.length).toBe(1);
  });

  it('skips recurring that starts after end date', async () => {
    const recurring = [rt({ frequency: 'Monthly', startingDate: d('2025-01-01') })];
    const svcSpy = mockTransactionService([]);
    const generator = new TransactionGenerator(recurring, [], svcSpy);

    await generator.Generate(d('2024-01-01'), d('2024-12-31'), 0);
    expect(generator.transactions.length).toBe(0);
  });

  it('merges without replacing existing when replace=false', async () => {
    const existing = [tx({ referenceId: 'rt1', date: d('2024-01-01') })];
    const recurring = [rt({ frequency: 'Monthly', startingDate: d('2024-01-01') })];
    const svcSpy = mockTransactionService(existing);
    const generator = new TransactionGenerator(recurring, [], svcSpy);

    await generator.Generate(d('2024-01-01'), d('2024-03-31'), 0);
    // Jan already exists, Feb+Mar are new → total 3
    expect(generator.transactions.length).toBe(3);
  });
});
