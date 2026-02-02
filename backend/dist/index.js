"use strict";
var __awaiter =
	(this && this.__awaiter) ||
	function (thisArg, _arguments, P, generator) {
		function adopt(value) {
			return value instanceof P
				? value
				: new P(function (resolve) {
						resolve(value);
					});
		}
		return new (P || (P = Promise))(function (resolve, reject) {
			function fulfilled(value) {
				try {
					step(generator.next(value));
				} catch (e) {
					reject(e);
				}
			}
			function rejected(value) {
				try {
					step(generator["throw"](value));
				} catch (e) {
					reject(e);
				}
			}
			function step(result) {
				result.done
					? resolve(result.value)
					: adopt(result.value).then(fulfilled, rejected);
			}
			step((generator = generator.apply(thisArg, _arguments || [])).next());
		});
	};
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod };
	};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const RecurringTransaction_1 = __importDefault(
	require("./models/RecurringTransaction"),
);
const Debt_1 = __importDefault(require("./models/Debt"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || "mongodb://mongo:27017/budget-app";
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/", (req, res) => {
	res.send("Budget App Backend is running");
});
// --- Recurring Transactions ---
// Check for duplicate name (Recurring Transactions)
app.get("/api/recurring-transactions/check-name/:name", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const { name } = req.params;
			const { excludeId } = req.query;
			const query = { name };
			if (excludeId) {
				query._id = { $ne: excludeId };
			}
			const existingTransaction =
				yield RecurringTransaction_1.default.findOne(query);
			res.json({ exists: !!existingTransaction });
		} catch (error) {
			res
				.status(500)
				.json({ message: "Error checking name uniqueness", error });
		}
	}),
);
// Get all recurring transactions
app.get("/api/recurring-transactions", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const transactions = yield RecurringTransaction_1.default
				.find()
				.sort({ name: 1 });
			res.json(transactions);
		} catch (error) {
			res.status(500).json({ message: "Error fetching transactions", error });
		}
	}),
);
// Create new recurring transaction
app.post("/api/recurring-transactions", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const newTransaction = new RecurringTransaction_1.default(req.body);
			const savedTransaction = yield newTransaction.save();
			res.status(201).json(savedTransaction);
		} catch (error) {
			if (error.code === 11000) {
				res
					.status(400)
					.json({ message: "Transaction with this name already exists" });
			} else {
				res.status(500).json({ message: "Error creating transaction", error });
			}
		}
	}),
);
// Update recurring transaction
app.put("/api/recurring-transactions/:id", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const { id } = req.params;
			const updatedTransaction =
				yield RecurringTransaction_1.default.findByIdAndUpdate(id, req.body, {
					new: true,
					runValidators: true,
				});
			if (!updatedTransaction) {
				return res.status(404).json({ message: "Transaction not found" });
			}
			res.json(updatedTransaction);
		} catch (error) {
			if (error.code === 11000) {
				res
					.status(400)
					.json({ message: "Transaction with this name already exists" });
			} else {
				res.status(500).json({ message: "Error updating transaction", error });
			}
		}
	}),
);
// Delete recurring transaction
app.delete("/api/recurring-transactions/:id", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const { id } = req.params;
			const deletedTransaction =
				yield RecurringTransaction_1.default.findByIdAndDelete(id);
			if (!deletedTransaction) {
				return res.status(404).json({ message: "Transaction not found" });
			}
			res.json({ message: "Transaction deleted successfully" });
		} catch (error) {
			res.status(500).json({ message: "Error deleting transaction", error });
		}
	}),
);
// --- Debts ---
// Check for duplicate name (Debts)
app.get("/api/debts/check-name/:name", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const { name } = req.params;
			const { excludeId } = req.query;
			const query = { name };
			if (excludeId) {
				query._id = { $ne: excludeId };
			}
			const existingDebt = yield Debt_1.default.findOne(query);
			res.json({ exists: !!existingDebt });
		} catch (error) {
			res
				.status(500)
				.json({ message: "Error checking debt name uniqueness", error });
		}
	}),
);
// Get all debts
app.get("/api/debts", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const debts = yield Debt_1.default.find().sort({ name: 1 });
			res.json(debts);
		} catch (error) {
			res.status(500).json({ message: "Error fetching debts", error });
		}
	}),
);
// Create new debt
app.post("/api/debts", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const newDebt = new Debt_1.default(req.body);
			const savedDebt = yield newDebt.save();
			res.status(201).json(savedDebt);
		} catch (error) {
			if (error.code === 11000) {
				res.status(400).json({ message: "Debt with this name already exists" });
			} else {
				res.status(500).json({ message: "Error creating debt", error });
			}
		}
	}),
);
// Update debt
app.put("/api/debts/:id", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const { id } = req.params;
			const updatedDebt = yield Debt_1.default.findByIdAndUpdate(id, req.body, {
				new: true,
				runValidators: true,
			});
			if (!updatedDebt) {
				return res.status(404).json({ message: "Debt not found" });
			}
			res.json(updatedDebt);
		} catch (error) {
			if (error.code === 11000) {
				res.status(400).json({ message: "Debt with this name already exists" });
			} else {
				res.status(500).json({ message: "Error updating debt", error });
			}
		}
	}),
);
// Delete debt
app.delete("/api/debts/:id", (req, res) =>
	__awaiter(void 0, void 0, void 0, function* () {
		try {
			const { id } = req.params;
			const deletedDebt = yield Debt_1.default.findByIdAndDelete(id);
			if (!deletedDebt) {
				return res.status(404).json({ message: "Debt not found" });
			}
			res.json({ message: "Debt deleted successfully" });
		} catch (error) {
			res.status(500).json({ message: "Error deleting debt", error });
		}
	}),
);
mongoose_1.default
	.connect(mongoUri)
	.then(() => {
		console.log("Connected to MongoDB");
		app.listen(port, () => {
			console.log(`Server is running on port ${port}`);
		});
	})
	.catch((err) => {
		console.error("Failed to connect to MongoDB", err);
	});
