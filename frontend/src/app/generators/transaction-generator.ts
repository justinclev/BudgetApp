import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';
import { TransactionService } from '../services/transaction.service';
import { firstValueFrom } from 'rxjs';

export class TransactionGenerator {
  transactions: Transaction[] = [];
  private recurringTransactions: RecurringTransaction[];
  private debts: Debt[];
  private transactionService: TransactionService;

  constructor(
    recurringTransactions: RecurringTransaction[],
    debts: Debt[],
    transactionService: TransactionService,
  ) {
    this.recurringTransactions = recurringTransactions;
    this.debts = debts;
    this.transactionService = transactionService;
  }

  async Generate(startDate: Date, endDate: Date, currentBalance: number): Promise<void> {
    this.transactions = [];

    // Fetch existing transactions
    const existingTransactions = await firstValueFrom(this.transactionService.getTransactions());

    // Generate new transactions based on rules
    const generatedTransactions: Transaction[] = [];

    // Normalize dates to start of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    for (const rt of this.recurringTransactions) {
      let currentDate: Date;
      const d = new Date(rt.startingDate);
      currentDate = new Date(d);
      currentDate.setHours(0, 0, 0, 0);

      if (currentDate > end) continue;

      while (currentDate <= end) {
        if (currentDate >= start) {
          const newTransaction: Transaction = {
            name: rt.name,
            description: rt.description,
            amount: rt.amount,
            date: new Date(currentDate),
            type: rt.type === 'income' ? 'Income' : 'Recurring',
            referenceId: rt._id,
          };
          generatedTransactions.push(newTransaction);
        }
        currentDate = this.getNextDate(currentDate, rt.frequency);
      }
    }

    // Merge Logic
    // Index existing transactions by a unique key (ReferenceID + Date)
    // If ReferenceID is missing (manual transaction), we just keep it.
    const transactionMap = new Map<string, Transaction>();
    const finalTransactions: Transaction[] = [];

    // Add all existing transactions first (they take precedence)
    for (const t of existingTransactions) {
      // Fix date string to object if coming from JSON
      t.date = new Date(t.date);
      finalTransactions.push(t);

      if (t.referenceId) {
        const dateStr = t.date.toISOString().split('T')[0]; // YYYY-MM-DD
        const key = `${t.referenceId}-${dateStr}`;
        transactionMap.set(key, t);
      }
    }

    // Add generated transactions if they don't exist in the map
    for (const t of generatedTransactions) {
      if (t.referenceId) {
        const dateStr = t.date.toISOString().split('T')[0];
        const key = `${t.referenceId}-${dateStr}`;
        if (!transactionMap.has(key)) {
          finalTransactions.push(t);
        }
      } else {
        // Should not happen for generated recurring transactions, but strictly:
        finalTransactions.push(t);
      }
    }

    this.transactions = finalTransactions;

    // Sort transactions by date
    this.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balances
    this.calculateBalances(currentBalance);

    // Save to DB (Fire and forget or await? Prompt implies retrieval is part of generate, saving is likely expected too)
    // The prompt says "I want all the transactions saved into one document".
    // We should save the result.
    await firstValueFrom(this.transactionService.saveTransactions(this.transactions));
  }

  private calculateBalances(initialBalance: number) {
    let runningBalance = initialBalance;
    const debtBalances = new Map<string, number>();

    this.debts.forEach((d) => {
      if (d._id) debtBalances.set(d._id, d.amountOwed);
    });

    const rtMap = new Map<string, RecurringTransaction>();
    this.recurringTransactions.forEach((rt) => {
      if (rt._id) rtMap.set(rt._id, rt);
    });

    for (const t of this.transactions) {
      const balancePrior = runningBalance;

      if (t.type === 'Income') {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }

      const balanceAfter = runningBalance;

      let debtPrior: number | undefined;
      let debtAfter: number | undefined;

      if (t.referenceId) {
        const rt = rtMap.get(t.referenceId);
        if (rt && rt.linkedDebtId) {
          debtPrior = debtBalances.get(rt.linkedDebtId);
          if (debtPrior !== undefined) {
            debtAfter = debtPrior - t.amount;
            debtBalances.set(rt.linkedDebtId, debtAfter);
          }
        }
      }

      t.balances = {
        BalancePrior: balancePrior,
        BalanceAfter: balanceAfter,
        DebtBalancePrior: debtPrior,
        DebtBalanceAfter: debtAfter,
      };
    }
  }

  private getNextDate(date: Date, frequency: string): Date {
    const nextDate = new Date(date);
    switch (frequency) {
      case 'Daily':
        nextDate.setDate(date.getDate() + 1);
        break;
      case 'Weekly':
        nextDate.setDate(date.getDate() + 7);
        break;
      case 'Bi-Weekly':
        nextDate.setDate(date.getDate() + 14);
        break;
      case 'Semi-Monthly':
        // Standard definition: 1st and 15th, or 15th and last day?
        // Or simply adding 15 days?
        // Usually 15 days is an approximation.
        // A common strict definition: if day <= 15, go to 15. If > 15, go to 1st of next month.
        // Let's assume simpler +15 days or specific logic if required.
        // For accurate semi-monthly (e.g. 1st and 15th):
        if (date.getDate() < 15) {
          nextDate.setDate(15);
        } else {
          nextDate.setMonth(date.getMonth() + 1);
          nextDate.setDate(1);
        }
        break;
      case 'Monthly':
        nextDate.setMonth(date.getMonth() + 1);
        break;
      case 'Annually':
        nextDate.setFullYear(date.getFullYear() + 1);
        break;
      default:
        // Default to daily or handle error?
        // For safety, advance by 1 day to prevent infinite loops if frequency is missing
        nextDate.setDate(date.getDate() + 1);
        break;
    }
    return nextDate;
  }
}
