import mongoose, { Schema, Document } from 'mongoose';

export interface IRecurringTransaction extends Document {
  name: string;
  description: string;
  amount: number;
  frequency: 'Daily' | 'Weekly' | 'Bi-Weekly' | 'Semi-Monthly' | 'Monthly' | 'Annually';
  startingDate: Date;
}

const RecurringTransactionSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  frequency: { 
    type: String, 
    required: true, 
    enum: ['Daily', 'Weekly', 'Bi-Weekly', 'Semi-Monthly', 'Monthly', 'Annually'] 
  },
  startingDate: { type: Date, required: true }
});

export default mongoose.model<IRecurringTransaction>('RecurringTransaction', RecurringTransactionSchema);
