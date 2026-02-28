#!/usr/bin/env node
/**
 * migrate.js — One-time DB migration script
 *
 * What it does:
 *  1. Renames user_id  → createdByUserId in debts + recurringtransactions
 *  2. Renames/removes old "user" field → createdByUserId in transactions (generated)
 *  3. Adds createdByUserId to lists (copied from ownerId)
 *  4. Updates Alice's old IDs ("123", "default") to the canonical ObjectId string
 *  5. Updates Bob's old ID ("2") to the canonical ObjectId string
 *  6. Drops old name_1 / name_1_user_id_1 indexes and creates compound ones
 *
 * Usage:
 *   MONGO_URI="mongodb+srv://..." node scripts/migrate.js
 *   -- or --
 *   node scripts/migrate.js   (uses the hardcoded URI below as fallback)
 */

const { MongoClient } = require("mongodb");

// ── Canonical user IDs ────────────────────────────────────────────────────
const ALICE_NEW_ID = "507f1f77bcf86cd799439011";
const BOB_NEW_ID = "507f1f77bcf86cd799439012";

// Old IDs that may exist in the database from before this migration
const ALICE_OLD_IDS = ["123", "default"];
const BOB_OLD_IDS = ["2"];

// ── DB connection ─────────────────────────────────────────────────────────
const MONGO_URI =
	process.env.MONGO_URI ||
	"mongodb+srv://admin:I98gw2zKiEn8iMov@budgetflowdb.anhdnhq.mongodb.net/?appName=BudgetFlowDB";

async function run() {
	const client = new MongoClient(MONGO_URI);
	await client.connect();
	console.log("✅ Connected to MongoDB");

	const db = client.db("budget-app");
	const debts = db.collection("debts");
	const recurring = db.collection("recurringtransactions");
	const generated = db.collection("transactions");
	const lists = db.collection("lists");

	// ── 1. DEBTS ─────────────────────────────────────────────────────────────
	console.log("\n── debts ────────────────────────────────────────────");

	// Rename user_id → createdByUserId (MongoDB $rename)
	let r = await debts.updateMany(
		{ user_id: { $exists: true } },
		{ $rename: { user_id: "createdByUserId" } },
	);
	console.log(`  renamed user_id → createdByUserId: ${r.modifiedCount} docs`);

	// Fix Alice's old IDs
	for (const oldId of ALICE_OLD_IDS) {
		r = await debts.updateMany(
			{ createdByUserId: oldId },
			{ $set: { createdByUserId: ALICE_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Alice "${oldId}" → "${ALICE_NEW_ID}": ${r.modifiedCount} docs`,
			);
	}

	// Fix Bob's old IDs
	for (const oldId of BOB_OLD_IDS) {
		r = await debts.updateMany(
			{ createdByUserId: oldId },
			{ $set: { createdByUserId: BOB_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Bob "${oldId}" → "${BOB_NEW_ID}": ${r.modifiedCount} docs`,
			);
	}

	// Stamp any still-missing docs as Alice
	r = await debts.updateMany(
		{ createdByUserId: { $exists: false } },
		{ $set: { createdByUserId: ALICE_NEW_ID } },
	);
	if (r.modifiedCount)
		console.log(
			`  stamped missing createdByUserId as Alice: ${r.modifiedCount} docs`,
		);

	// Rebuild index
	try {
		await debts.dropIndex("name_1");
	} catch {}
	try {
		await debts.dropIndex("name_1_user_id_1");
	} catch {}
	await debts.createIndex({ name: 1, createdByUserId: 1 }, { unique: true });
	console.log("  index (name, createdByUserId) created");

	// ── 2. RECURRING TRANSACTIONS ─────────────────────────────────────────────
	console.log("\n── recurringtransactions ────────────────────────────");

	r = await recurring.updateMany(
		{ user_id: { $exists: true } },
		{ $rename: { user_id: "createdByUserId" } },
	);
	console.log(`  renamed user_id → createdByUserId: ${r.modifiedCount} docs`);

	for (const oldId of ALICE_OLD_IDS) {
		r = await recurring.updateMany(
			{ createdByUserId: oldId },
			{ $set: { createdByUserId: ALICE_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Alice "${oldId}" → "${ALICE_NEW_ID}": ${r.modifiedCount} docs`,
			);
	}
	for (const oldId of BOB_OLD_IDS) {
		r = await recurring.updateMany(
			{ createdByUserId: oldId },
			{ $set: { createdByUserId: BOB_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Bob "${oldId}" → "${BOB_NEW_ID}": ${r.modifiedCount} docs`,
			);
	}
	r = await recurring.updateMany(
		{ createdByUserId: { $exists: false } },
		{ $set: { createdByUserId: ALICE_NEW_ID } },
	);
	if (r.modifiedCount)
		console.log(`  stamped missing: ${r.modifiedCount} docs`);

	try {
		await recurring.dropIndex("name_1");
	} catch {}
	try {
		await recurring.dropIndex("name_1_user_id_1");
	} catch {}
	await recurring.createIndex(
		{ name: 1, createdByUserId: 1 },
		{ unique: true },
	);
	console.log("  index (name, createdByUserId) created");

	// ── 3. GENERATED TRANSACTIONS ─────────────────────────────────────────────
	console.log("\n── transactions (generated) ─────────────────────────");

	// Old field was "user" with values "default", "123", etc. → rename to createdByUserId
	r = await generated.updateMany(
		{ user: { $exists: true } },
		{ $rename: { user: "createdByUserId" } },
	);
	console.log(`  renamed user → createdByUserId: ${r.modifiedCount} docs`);

	for (const oldId of [...ALICE_OLD_IDS]) {
		r = await generated.updateMany(
			{ createdByUserId: oldId },
			{ $set: { createdByUserId: ALICE_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Alice "${oldId}" → "${ALICE_NEW_ID}": ${r.modifiedCount} docs`,
			);
	}
	for (const oldId of BOB_OLD_IDS) {
		r = await generated.updateMany(
			{ createdByUserId: oldId },
			{ $set: { createdByUserId: BOB_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Bob "${oldId}" → "${BOB_NEW_ID}": ${r.modifiedCount} docs`,
			);
	}
	r = await generated.updateMany(
		{ createdByUserId: { $exists: false } },
		{ $set: { createdByUserId: ALICE_NEW_ID } },
	);
	if (r.modifiedCount)
		console.log(`  stamped missing: ${r.modifiedCount} docs`);

	// ── 4. LISTS ──────────────────────────────────────────────────────────────
	console.log("\n── lists ────────────────────────────────────────────");

	// Add createdByUserId where missing, copying from ownerId
	// First, fix Alice's old IDs in ownerId/authorizedUsers
	for (const oldId of ALICE_OLD_IDS) {
		r = await lists.updateMany(
			{ ownerId: oldId },
			{ $set: { ownerId: ALICE_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Alice ownerId "${oldId}" → new ID: ${r.modifiedCount} docs`,
			);

		// Fix authorizedUsers array entries
		r = await lists.updateMany(
			{ authorizedUsers: oldId },
			{ $set: { "authorizedUsers.$": ALICE_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Alice authorizedUsers "${oldId}" → new ID: ${r.modifiedCount} docs`,
			);
	}
	for (const oldId of BOB_OLD_IDS) {
		r = await lists.updateMany(
			{ ownerId: oldId },
			{ $set: { ownerId: BOB_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(`  Bob ownerId "${oldId}" → new ID: ${r.modifiedCount} docs`);

		r = await lists.updateMany(
			{ authorizedUsers: oldId },
			{ $set: { "authorizedUsers.$": BOB_NEW_ID } },
		);
		if (r.modifiedCount)
			console.log(
				`  Bob authorizedUsers "${oldId}" → new ID: ${r.modifiedCount} docs`,
			);
	}

	// Now copy ownerId → createdByUserId for all lists missing the field
	const listsWithoutField = await lists
		.find({ createdByUserId: { $exists: false } })
		.toArray();
	let stamped = 0;
	for (const list of listsWithoutField) {
		await lists.updateOne(
			{ _id: list._id },
			{ $set: { createdByUserId: list.ownerId || ALICE_NEW_ID } },
		);
		stamped++;
	}
	if (stamped)
		console.log(`  copied ownerId → createdByUserId: ${stamped} docs`);

	// ── Done ──────────────────────────────────────────────────────────────────
	console.log("\n✅ Migration complete");
	await client.close();
}

run().catch((err) => {
	console.error("❌ Migration failed:", err);
	process.exit(1);
});
