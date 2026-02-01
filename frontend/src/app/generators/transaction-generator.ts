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
   * @param replace If true, delete existing transactions before generating:
   *                - If recurringTransactionId is "", delete ALL transactions
   *                - If recurringTransactionId is specified, delete only those transactions
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
    let existing = await firstValueFrom(this.transactionService.getTransactions());

    // Replace strategy: delete relevant transactions before merging
    if (replace) {
      existing = this.deleteRelevantTransactions(existing, recurringTransactionId);
    }

    // Merge strategy: add generated transactions to what remains
    this.transactions = replace
      ? [...existing, ...generated]
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
    console.log('🔨 [generateTransactions] Called with:', { start, end, recurringTransactionId });

    // Filter to specific recurring transaction if provided
    const recurring =
      recurringTransactionId.length > 0
        ? this.recurringTransactions.filter((rt) => rt._id === recurringTransactionId)
        : this.recurringTransactions;
    console.log(
      `📋 [generateTransactions] Processing ${recurring.length} recurring transaction(s)`,
      recurringTransactionId ? `(filtered to ID: ${recurringTransactionId})` : '(all)',
    );

    const generated: Transaction[] = [];

    for (const rt of recurring) {
      let currentDate = this.normalizeDate(rt.startingDate, 'start');
      console.log(
        `  📌 Processing recurring: "${rt.name}" (${rt.frequency}) - Starting: ${currentDate}`,
      );

      // Skip if recurring starts after end date
      if (currentDate > end) {
        continue;
      }

      // Generate transaction for each occurrence in date range
      let occurrenceCount = 0;
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
          occurrenceCount++;
        }
        currentDate = this.getNextDate(currentDate, rt.frequency);
      }
    }

    return generated;
  }

  /**
   * Delete transactions based on replacement strategy
   * (Financial principle: Clean slate allows complete regeneration)
   *
   * @param existing All existing transactions
   * @param recurringTransactionId If empty, delete all; if specified, delete only for that ID
   * @returns Filtered transactions to keep
   */
  private deleteRelevantTransactions(
    existing: Transaction[],
    recurringTransactionId: string,
  ): Transaction[] {
    if (recurringTransactionId.length === 0) {
      // Delete ALL transactions - complete regeneration
      return [];
    }

    // Delete only transactions related to this recurring transaction
    const filtered = existing.filter((t) => t.referenceId !== recurringTransactionId);
    return filtered;
  }

  /**
   * Merge strategy: Keep existing, only add new generated transactions
   * (Financial principle: Trust historical data - don't overwrite user records)
   */
  private mergeWithoutReplacement(
    existing: Transaction[],
    generated: Transaction[],
  ): Transaction[] {
    console.log(
      `🔗 [mergeWithoutReplacement] Merging ${existing.length} existing + ${generated.length} generated`,
    );

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
    let duplicatesSkipped = 0;
    let newTransactionsAdded = 0;
    for (const t of generated) {
      const key = `${t.referenceId}-${this.dateKey(t.date)}`;
      if (!existingMap.has(key)) {
        merged.push(t);
        newTransactionsAdded++;
      } else {
        duplicatesSkipped++;
      }
    }

    console.log(
      `  ✓ Added: ${newTransactionsAdded} new | Skipped: ${duplicatesSkipped} duplicates | Total: ${merged.length}`,
    );
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

    let incomeTotal = 0;
    let expenseTotal = 0;

    for (const t of this.transactions) {
      const balancePrior = runningBalance;

      // Update running balance: income adds, expenses subtract
      if (t.type === 'Income') {
        incomeTotal += t.amount;
        runningBalance += t.amount;
      } else {
        expenseTotal += t.amount;
        runningBalance -= t.amount;
      }

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
