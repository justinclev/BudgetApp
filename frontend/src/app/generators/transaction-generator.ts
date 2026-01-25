import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';

export class TransactionGenerator {
  transactions: Transaction[] = [];
  private recurringTransactions: RecurringTransaction[];
  private debts: Debt[];

  constructor(recurringTransactions: RecurringTransaction[], debts: Debt[]) {
    this.recurringTransactions = recurringTransactions;
    this.debts = debts;
  }

  Generate(startDate: Date, endDate: Date, currentBalance: number): void {
    this.transactions = []; // Reset transactions
    
    // Normalize dates to start of day to avoid time discrepancies
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    for (const rt of this.recurringTransactions) {
      // Parse startingDate ensuring we preserve the calendar day
      let currentDate: Date;
      const d = new Date(rt.startingDate);
      currentDate = new Date(d);
      currentDate.setHours(0, 0, 0, 0);
      
      // If the recurring transaction starts after the end date, skip it
      if (currentDate > end) continue;

      // Loop to generate transactions
      while (currentDate <= end) {
        if (currentDate >= start) {
            // Create a new Transaction object
            const newTransaction: Transaction = {
                name: rt.name,
                description: rt.description,
                amount: rt.amount,
                date: new Date(currentDate), // Copy date
                type: 'Recurring',
                referenceId: rt._id
            };
            this.transactions.push(newTransaction);
        }

        // Advance date based on frequency
        currentDate = this.getNextDate(currentDate, rt.frequency);
      }
    }

    // Sort transactions by date
    this.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balances
    this.calculateBalances(currentBalance);
  }

  private calculateBalances(initialBalance: number) {
    let runningBalance = initialBalance;
    const debtBalances = new Map<string, number>();
    
    this.debts.forEach(d => {
        if (d._id) debtBalances.set(d._id, d.currentBalance);
    });

    const rtMap = new Map<string, RecurringTransaction>();
    this.recurringTransactions.forEach(rt => {
        if (rt._id) rtMap.set(rt._id, rt);
    });

    for (const t of this.transactions) {
        const balancePrior = runningBalance;
        
        // For now, assume all Recurring transactions are expenses (withdrawals)
        // In the future, we could have a 'type' or 'category' on RecurringTransaction
        runningBalance -= t.amount;
        
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
            DebtBalanceAfter: debtAfter
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
