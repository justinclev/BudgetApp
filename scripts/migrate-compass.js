// ─────────────────────────────────────────────────────────────────────────────
// Budget App — DB Migration Script
// Run this in MongoDB Compass → "Open MongoDB Shell" (or Mongosh)
// Make sure you are connected to the "budget-app" database first.
// ─────────────────────────────────────────────────────────────────────────────

const ALICE_ID = "507f1f77bcf86cd799439011";

db.debts.updateMany({}, { $set: { createdByUserId: ALICE_ID } });
db.recurringtransactions.updateMany({}, { $set: { createdByUserId: ALICE_ID } });
db.transactions.updateMany({}, { $set: { createdByUserId: ALICE_ID } });
db.lists.updateMany({}, { $set: { createdByUserId: ALICE_ID } });

print("✅ Done — all records assigned to Alice");
