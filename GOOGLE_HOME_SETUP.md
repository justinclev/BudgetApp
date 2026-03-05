# Google Home Integration Setup (IFTTT Webhook)

BudgetFlow supports voice commands via Google Home using the IFTTT Webhook workaround
(Google deprecated Conversational Actions in June 2023).

**Architecture:**
1. User generates a personal Webhook API Key inside the app (`/integrations` page).
2. User configures an IFTTT Applet — Google Assistant trigger → Webhooks action.
3. When the user speaks, IFTTT POSTs to the Rust backend with the key in the `Authorization` header.

---

## Step 1 — Deploy the backend

Your webhook URL must be publicly accessible. IFTTT cannot reach `localhost`.

- Deploy to Railway, Render, Fly.io, or your existing host.
- Your webhook URL will be: `https://your-domain.com/api/integrations/ifttt-webhook`

---

## Step 2 — Generate your API key

1. Log in to BudgetFlow and navigate to **Settings → Integrations** (`/integrations`).
2. Click **Generate Webhook API Key**.
3. Copy the key — you will paste it into IFTTT in Step 4.

> Generating a new key immediately invalidates the previous one.

---

## Step 3 — Create an IFTTT account

Go to **ifttt.com** and sign up. The free tier supports up to 2 applets.
IFTTT Pro ($2.99/mo) is required if you want more than 2 applets.

---

## Step 4 — Create an Applet for each voice command

1. Click **Create** → **If This**
2. Search for **Google Assistant** → choose:
   - **"Say a simple phrase"** — fixed trigger, no variable
   - **"Say a phrase with a text ingredient"** — spoken variable available as `{{TextField}}`
3. Set your trigger phrase (examples below).
4. Click **Then That** → search **Webhooks** → **Make a web request**
5. Configure the Webhooks action:

| Field | Value |
|---|---|
| **URL** | `https://your-domain.com/api/integrations/ifttt-webhook` |
| **Method** | `POST` |
| **Content Type** | `application/json` |
| **Additional Headers** | `Authorization: Bearer YOUR_API_KEY_HERE` |
| **Body** | See examples below |

---

## Step 5 — Applet body examples

### Add an item to a list (spoken item name)
Trigger phrase: *"Add $$ to my groceries list"*
```json
{"action": "add_item", "listName": "Groceries", "text": "{{TextField}}"}
```

### Add a recurring todo item
Trigger phrase: *"Add weekly chore $$"*
```json
{
  "action": "add_todo_item",
  "listName": "Chores",
  "text": "{{TextField}}",
  "repeatFrequency": "weekly"
}
```

### Add a todo item with a due date
Trigger phrase: *"Add task $$ due this Friday"*
```json
{
  "action": "add_todo_item",
  "listName": "Tasks",
  "text": "{{TextField}}",
  "completeByDate": "2026-03-06"
}
```

### Create a new list
Trigger phrase: *"Create a list called $$"*
```json
{"action": "create_list", "text": "{{TextField}}", "listType": "todo"}
```

### Mark a todo occurrence as done (by text + today's date)
Trigger phrase: *"Mark $$ as done"*
```json
{
  "action": "mark_todo_done",
  "listName": "Chores",
  "text": "{{TextField}}",
  "date": "{{CreatedAt | date:'yyyy-MM-dd'}}"
}
```

### Mark a shopping list item as done
Trigger phrase: *"I got $$"*
```json
{"action": "mark_item_done", "listName": "Groceries", "text": "{{TextField}}"}
```

### Log an expense
Trigger phrase: *"I spent $$ dollars on food"*
```json
{"action": "add_expense", "category": "food", "amount": {{TextField}}}
```

---

## Supported Actions — Full Reference

| Action | Required | Optional |
|---|---|---|
| `add_todo_item` | `text`, `listId` or `listName` | `completeByDate`, `repeatFrequency` |
| `add_item` | `text`, `listId` or `listName` | — |
| `create_list` | `text` (list name) | `listType`, `completeByDate`, `repeatFrequency` |
| `mark_todo_done` | `occurrenceId` — OR — `text` + `date` | `listId`, `listName` |
| `mark_item_done` | `listId` or `listName`, plus `text` or `itemId` | — |
| `add_expense` | `amount` | `category` |
| `check_balance` | — | — |

### Field Reference

| Field | Type | Notes |
|---|---|---|
| `action` | string | One of the actions above |
| `listId` | string | MongoDB ObjectId of the list (fastest lookup) |
| `listName` | string | Case-insensitive name search (use when `listId` is unknown) |
| `text` | string | Item text, list name for `create_list`, or search text |
| `listType` | string | `"todo"` \| `"shopping"` \| `"general"` (default: `"todo"`) |
| `completeByDate` | string | YYYY-MM-DD or RFC3339 |
| `repeatFrequency` | string | `daily` \| `weekly` \| `biweekly` \| `monthly` \| `yearly` |
| `occurrenceId` | string | MongoDB ObjectId of a `todo_occurrence` document |
| `itemId` | string | List item's `id` field (not the list's `_id`) |
| `date` | string | YYYY-MM-DD for occurrence lookup |
| `amount` | number | Dollar amount for `add_expense` |
| `category` | string | Expense category |

---

## Test the endpoint directly (curl)

```bash
# Health check — add an item
curl -X POST https://your-domain.com/api/integrations/ifttt-webhook \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"add_item","listName":"Groceries","text":"Milk"}'

# Mark a todo done by text + date
curl -X POST https://your-domain.com/api/integrations/ifttt-webhook \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"mark_todo_done","listName":"Chores","text":"Clean bathroom","date":"2026-03-04"}'
```

---

## Limitations

- **IFTTT Free** supports up to 2 active applets. **IFTTT Pro** ($2.99/mo) removes this limit.
- IFTTT text ingredients (`{{TextField}}`) capture **one spoken variable** per applet. For commands that need both an item name and a list name by voice, you need separate applets — one per list — with the list name hardcoded in the JSON body.
- IFTTT → Webhook latency is typically **1–5 seconds** after you speak.
- Google Assistant on Google Home supports this via standard IFTTT triggers; no special Google Cloud setup is needed.

---

## Relevant Source Files

| File | Purpose |
|---|---|
| `backend_rust/src/handlers/integration_handler.rs` | Rust handler — key generation + webhook dispatch |
| `backend_rust/src/models.rs` | `IftttWebhookRequest` struct + `User.webhookApiKey` field |
| `backend_rust/src/db.rs` | Sparse unique index on `users.webhookApiKey` |
| `backend_rust/src/main.rs` | Route registration |
| `apps/list/src/app/integrations/integrations.component.ts` | Angular component |
| `apps/list/src/app/services/integrations.service.ts` | Angular HTTP service |
| `apps/list/src/app/app.routes.ts` | `/integrations` route |
