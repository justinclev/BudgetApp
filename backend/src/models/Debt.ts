import mongoose, { Schema, Document } from 'mongoose';

export interface IDebt extends Document {
  name: string;
  amountOwed: number;
  interestRate: number;
  minimumPayment?: number;
  paymentDate?: Date;
  frequency?: 'Daily' | 'Weekly' | 'Bi-Weekly' | 'Semi-Monthly' | 'Monthly' | 'Annually';
}

const DebtSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  amountOwed: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  minimumPayment: { type: Number, required: false },
  paymentDate: { type: Date, required: false },
  frequency: { 
    type: String, 
    required: false, 
    enum: ['Daily', 'Weekly', 'Bi-Weekly', 'Semi-Monthly', 'Monthly', 'Annually'] 
  }
});

export default mongoose.model<IDebt>('Debt', DebtSchema);
