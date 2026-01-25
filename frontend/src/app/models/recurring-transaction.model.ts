import { Frequency } from './frequency.model';

export interface RecurringTransaction {
  _id?: string;
  name: string;
  description: string;
  amount: number;
  frequency: Frequency;
  startingDate: Date;
  linkedDebtId?: string; // Reference to a Debt if this is a payment
}
