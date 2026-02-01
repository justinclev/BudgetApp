import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { Debt } from '../models/debt.model';
import { RecurringTransaction } from '../models/recurring-transaction.model';

/**
 * Service for calculating running balances and debt balances with interest
 * Provides consistent balance calculation logic across the application
 */
@Injectable({
  providedIn: 'root',
})
export class BalanceCalculationService {
  /**
   * Calculate running balance and debt balances for all transactions
   * Applies monthly interest to debts after each payment
   *
   * @param transactions Array of transactions to calculate balances for (modified in place)
   * @param debts Array of debts with interest rates
   * @param recurring Array of recurring transactions for debt linkage
   * @param initialBalance Starting balance for calculations
   */
  calculateBalances(
    transactions: Transaction[],
    debts: Debt[],
    recurring: RecurringTransaction[],
    initialBalance: number,
  ): void {
    let runningBalance = initialBalance;
    const debtBalances = new Map<string, number>();
    const debtInterestMap = new Map<string, number>();

    // Initialize debt balances and interest rates
    debts.forEach((d) => {
      if (d._id) {
        debtBalances.set(d._id, d.amountOwed);
        debtInterestMap.set(d._id, d.interestRate || 0);
      }
    });

    // Create recurring transaction map for lookups
    const rtMap = new Map<string, RecurringTransaction>();
    recurring.forEach((rt) => {
      if (rt._id) rtMap.set(rt._id, rt);
    });

    // Process each transaction
    for (const t of transactions) {
      const balancePrior = runningBalance;

      // Update running balance: income adds, expenses subtract
      if (t.type === 'Income') {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }

      const balanceAfter = runningBalance;
      let debtPrior: number | undefined;
      let debtAfter: number | undefined;

      // Update debt balance if this transaction is linked to a debt
      if (t.referenceId) {
        const rt = rtMap.get(t.referenceId);
        if (rt && rt.linkedDebtId) {
          debtPrior = debtBalances.get(rt.linkedDebtId);
          if (debtPrior !== undefined) {
            // Apply payment (reduce debt)
            let debtBalance = debtPrior - t.amount;

            // Apply interest if debt still exists and has interest rate
            const interestRate = debtInterestMap.get(rt.linkedDebtId) || 0;
            if (debtBalance > 0 && interestRate > 0) {
              const monthlyInterestRate = interestRate / 100 / 12;
              const interestCharge = debtBalance * monthlyInterestRate;
              debtBalance += interestCharge;
            }

            debtAfter = debtBalance;
            debtBalances.set(rt.linkedDebtId, debtAfter);
          }
        }
      }

      // Attach balance info to transaction
      t.balances = {
        BalancePrior: balancePrior,
        BalanceAfter: balanceAfter,
        DebtBalancePrior: debtPrior,
        DebtBalanceAfter: debtAfter,
      };
    }
  }
}
