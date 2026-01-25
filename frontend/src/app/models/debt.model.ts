import { Frequency } from './frequency.model';

export interface Debt {
  _id?: string;
  name: string;
  amountOwed: number; // Original amount or total capacity
  currentBalance: number; // Current remaining balance
  interestRate: number;
  minimumPayment?: number;
  paymentDate?: Date;
  frequency?: Frequency;
}
