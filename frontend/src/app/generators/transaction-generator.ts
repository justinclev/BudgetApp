import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';
import { TransactionService } from '../services/transaction.service';
import { firstValueFrom } from 'rxjs';

/** Generates recurring transactions and calculates running balances */
export class TransactionGenerator {
  transactions: Transaction[] = [];

  constructor(
    private recurringTransactions: RecurringTransaction[],
    private debts: Debt[],
    private transactionService: TransactionService,
  ) {}

  /**
   * Generates recurring transactions for a date range with intelligent merge strategy
   *
   * @param startDate Start of generation period
   * @param endDate End of generation period
   * @param currentBalance Starting balance for balance calculations
   * @param recurringTransactionId Optional: generate only for this recurring transaction type
   * @param replace If true, replace existing duplicates with newly generated transactions.
   *                If both recurringTransactionId and replace are true, only replace
   *                duplicates for that specific recurring transaction.
   */
  async Generate(
    startDate: Date,
    endDate: Date,
    currentBalance: number,
    recurringTransactionId: string = '',
    replace: boolean = false,
  ): Promise<void> {
    // Normalize dates to day boundaries
    const start = this.normalizeDate(startDate, 'start');
    const end = this.normalizeDate(endDate, 'end');

    // Generate new transactions from recurring rules
    const generated = this.generateTransactions(start, end, recurringTransactionId);

    // Get existing transactions from database
    const existing = await firstValueFrom(this.transactionService.getTransactions());

    // Merge strategy: replace old duplicates if requested, otherwise keep existing
    this.transactions = replace
      ? this.mergeWithReplacement(existing, generated, recurringTransactionId)
      : this.mergeWithoutReplacement(existing, generated);

    // Calculate running balance and debt balances from starting point
    this.calculateBalances(currentBalance);

    // Persist to database
    await firstValueFrom(this.transactionService.saveTransactions(this.transactions));
  }

  /** Normalize date to start (00:00:00) or end (23:59:59) of day */
  private normalizeDate(date: Date, type: 'start' | 'end'): Date {
    const d = new Date(date);
    if (type === 'start') {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  }

  /** Generate transactions based on recurring transaction rules */
  private generateTransactions(
    start: Date,
    end: Date,
    recurringTransactionId: string,
  ): Transaction[] {
    // Filter to specific recurring transaction if provided
    const recurring =
      recurringTransactionId.length > 0
        ? this.recurringTransactions.filter((rt) => rt._id === recurringTransactionId)
        : this.recurringTransactions;

    const generated: Transaction[] = [];

    for (const rt of recurring) {
      let currentDate = this.normalizeDate(rt.startingDate, 'start');

      // Skip if recurring starts after end date
      if (currentDate > end) continue;

      // Generate transaction for each occurrence in date range
      while (currentDate <= end) {
        if (currentDate >= start) {
          generated.push({
            name: rt.name,
            description: rt.description,
            amount: rt.amount,
            date: new Date(currentDate),
            type: rt.type === 'income' ? 'Income' : 'Recurring',
            referenceId: rt._id,
          });
        }
        currentDate = this.getNextDate(currentDate, rt.frequency);
      }
    }

    return generated;
  }

  /**
   * Merge strategy: Keep existing, only add new generated transactions
   * (Financial principle: Trust historical data - don't overwrite user records)
   */
  private mergeWithoutReplacement(
    existing: Transaction[],
    generated: Transaction[],
  ): Transaction[] {
    // Build index of existing transactions by "recurringId-date" for O(1) lookup
    const existingMap = new Map<string, Transaction>();

    const merged: Transaction[] = existing.map((t) => {
      t.date = new Date(t.date); // Ensure date objects
      if (t.referenceId) {
        const key = `${t.referenceId}-${this.dateKey(t.date)}`;
        existingMap.set(key, t);
      }
      return t;
    });

    // Add generated transactions only if they don't already exist
    for (const t of generated) {
      const key = `${t.referenceId}-${this.dateKey(t.date)}`;
      if (!existingMap.has(key)) {
        merged.push(t);
      }
    }

    return merged.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Merge strategy: Replace existing duplicates with newly generated transactions
   * (Financial principle: Regenerate allows user to correct rules and recalculate)
   *
   * If recurringTransactionId is specified, only replace duplicates for that type.
   * This prevents accidental overwrites of unrelated transactions.
   */
  private mergeWithReplacement(
    existing: Transaction[],
    generated: Transaction[],
    recurringTransactionId: string,
  ): Transaction[] {
    // Build index of generated transactions for fast duplicate detection
    const generatedMap = new Map<string, Transaction>();
    for (const t of generated) {
      const key = `${t.referenceId}-${this.dateKey(t.date)}`;
      generatedMap.set(key, t);
    }

    // Build set of recurring IDs to replace
    const idsToReplace = new Set<string>();
    if (recurringTransactionId.length > 0) {
      // Only replace this specific recurring transaction
      idsToReplace.add(recurringTransactionId);
    } else {
      // Replace all recurring transactions that have generated transactions
      for (const t of generated) {
        idsToReplace.add(t.referenceId!);
      }
    }

    // Keep existing transactions, but replace those matching our filter
    const merged: Transaction[] = [];
    for (const t of existing) {
      t.date = new Date(t.date);
      const key = `${t.referenceId}-${this.dateKey(t.date)}`;

      // If this is a duplicate of a generated transaction AND we're replacing this recurring type, skip it
      if (t.referenceId && idsToReplace.has(t.referenceId) && generatedMap.has(key)) {
        continue; // Skip - will be replaced by generated version
      }

      merged.push(t);
    }

    // Add all generated transactions (these are the fresh, regenerated ones)
    merged.push(...generated);

    return merged.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /** Convert date to YYYY-MM-DD key format */
  private dateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** Calculate running balance and debt payments for all transactions */
  private calculateBalances(initialBalance: number): void {
    let runningBalance = initialBalance;
    const debtMap = new Map(this.debts.map((d) => [d._id, d.amountOwed]));
    const rtMap = new Map(this.recurringTransactions.map((rt) => [rt._id, rt]));

    for (const t of this.transactions) {
      const balancePrior = runningBalance;

      // Update running balance: income adds, expenses subtract
      runningBalance += t.type === 'Income' ? t.amount : -t.amount;

      // Update debt balance if this transaction is linked to a debt
      let debtPrior: number | undefined;
      let debtAfter: number | undefined;

      if (t.referenceId) {
        const rt = rtMap.get(t.referenceId);
        if (rt?.linkedDebtId) {
          debtPrior = debtMap.get(rt.linkedDebtId);
          if (debtPrior !== undefined) {
            debtAfter = debtPrior - t.amount;
            debtMap.set(rt.linkedDebtId, debtAfter);
          }
        }
      }

      // Attach balance info to transaction
      t.balances = {
        BalancePrior: balancePrior,
        BalanceAfter: runningBalance,
        DebtBalancePrior: debtPrior,
        DebtBalanceAfter: debtAfter,
      };
    }
  }

  /** Calculate next occurrence date based on frequency */
  private getNextDate(date: Date, frequency: string): Date {
    const next = new Date(date);

    switch (frequency) {
      case 'Daily':
        next.setDate(date.getDate() + 1);
        break;
      case 'Weekly':
        next.setDate(date.getDate() + 7);
        break;
      case 'Bi-Weekly':
        next.setDate(date.getDate() + 14);
        break;
      case 'Semi-Monthly':
        // 1st and 15th: if before 15th go to 15th, else go to 1st of next month
        if (date.getDate() < 15) {
          next.setDate(15);
        } else {
          next.setMonth(date.getMonth() + 1);
          next.setDate(1);
        }
        break;
      case 'Monthly':
        next.setMonth(date.getMonth() + 1);
        break;
      case 'Annually':
        next.setFullYear(date.getFullYear() + 1);
        break;
      default:
        // Prevent infinite loops - advance by 1 day for unknown frequencies
        next.setDate(date.getDate() + 1);
    }

    return next;
  }
}
