// Wrapper to include balance info with transaction to be displayed in the grid. This is not stored in DB directly, and recalculated on the fly.
export interface TransactionBalances {
  BalancePrior: number;
  BalanceAfter: number;

  DebtId?: string;
  DebtName?: string;
  DebtBalancePrior?: number;
  DebtBalanceAfter?: number;
}
