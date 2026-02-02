import { TransactionBalances } from './transaction-balances.model';

export interface Transaction {
  _id?: string;
  name: string;
  description: string;
  amount: number;
  date: Date;
  type: 'Recurring' | 'Debt' | 'One-Time' | 'Income';
  referenceId?: string; // ID of the related recurring transaction, Income, or Debt, if applicable, Determined by Type
  startingBalance?: number; // Starting balance used for balance calculations (set when user edits balance)
  deleted?: boolean; // Soft delete flag - if true, transaction is hidden from UI and calculations
  balances?: TransactionBalances; // Optional balance info for display purposes, not stored in DB
}
