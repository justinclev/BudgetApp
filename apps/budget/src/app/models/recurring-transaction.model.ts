import { Frequency } from './frequency.model';

export interface RecurringTransaction {
  _id?: string;
  name: string;
  description: string;
  amount: number;
  frequency: string;
  startingDate: Date;
  linkedDebtId?: string;
  type?: 'income' | 'expense';
}
