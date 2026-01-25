import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import RecurringTransaction from './models/RecurringTransaction';
import Debt from './models/Debt';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/budget-app';

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Budget App Backend is running');
});

// --- Recurring Transactions ---

// Check for duplicate name (Recurring Transactions)
app.get('/api/recurring-transactions/check-name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { excludeId } = req.query; 
    
    const query: any = { name };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingTransaction = await RecurringTransaction.findOne(query);
    res.json({ exists: !!existingTransaction });
  } catch (error) {
    res.status(500).json({ message: 'Error checking name uniqueness', error });
  }
});

// Get all recurring transactions
app.get('/api/recurring-transactions', async (req: Request, res: Response) => {
  try {
    const transactions = await RecurringTransaction.find().sort({ name: 1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error });
  }
});

// Create new recurring transaction
app.post('/api/recurring-transactions', async (req: Request, res: Response) => {
  try {
    const newTransaction = new RecurringTransaction(req.body);
    const savedTransaction = await newTransaction.save();
    res.status(201).json(savedTransaction);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Transaction with this name already exists' });
    } else {
      res.status(500).json({ message: 'Error creating transaction', error });
    }
  }
});

// Update recurring transaction
app.put('/api/recurring-transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedTransaction = await RecurringTransaction.findByIdAndUpdate(
      id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!updatedTransaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(updatedTransaction);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Transaction with this name already exists' });
    } else {
      res.status(500).json({ message: 'Error updating transaction', error });
    }
  }
});

// Delete recurring transaction
app.delete('/api/recurring-transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedTransaction = await RecurringTransaction.findByIdAndDelete(id);
    
    if (!deletedTransaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction', error });
  }
});

// --- Debts ---

// Check for duplicate name (Debts)
app.get('/api/debts/check-name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { excludeId } = req.query; 
    
    const query: any = { name };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingDebt = await Debt.findOne(query);
    res.json({ exists: !!existingDebt });
  } catch (error) {
    res.status(500).json({ message: 'Error checking debt name uniqueness', error });
  }
});

// Get all debts
app.get('/api/debts', async (req: Request, res: Response) => {
  try {
    const debts = await Debt.find().sort({ name: 1 });
    res.json(debts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching debts', error });
  }
});

// Create new debt
app.post('/api/debts', async (req: Request, res: Response) => {
  try {
    const newDebt = new Debt(req.body);
    const savedDebt = await newDebt.save();
    res.status(201).json(savedDebt);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Debt with this name already exists' });
    } else {
      res.status(500).json({ message: 'Error creating debt', error });
    }
  }
});

// Update debt
app.put('/api/debts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedDebt = await Debt.findByIdAndUpdate(
      id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!updatedDebt) {
      return res.status(404).json({ message: 'Debt not found' });
    }
    
    res.json(updatedDebt);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Debt with this name already exists' });
    } else {
      res.status(500).json({ message: 'Error updating debt', error });
    }
  }
});

// Delete debt
app.delete('/api/debts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedDebt = await Debt.findByIdAndDelete(id);
    
    if (!deletedDebt) {
      return res.status(404).json({ message: 'Debt not found' });
    }
    
    res.json({ message: 'Debt deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting debt', error });
  }
});

mongoose.connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
