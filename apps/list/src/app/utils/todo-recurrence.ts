import { UserList } from '../models/list.model';
import { RepeatFrequency } from '../models/list.model';

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

// ── Recurrence logic ─────────────────────────────────────────────────────────

/**
 * Returns true if `checkDate` is a scheduled occurrence for a recurring
 * schedule that started on `startDate`.
 */
export function isScheduledOn(startDate: Date, freq: RepeatFrequency, checkDate: Date): boolean {
  const start = startOfDay(startDate);
  const check = startOfDay(checkDate);
  if (check < start) return false;

  const diff = daysBetween(start, check);

  switch (freq) {
    case 'daily':
      return true;
    case 'every-other-day':
      return diff % 2 === 0;
    case 'weekly':
      return diff % 7 === 0;
    case 'biweekly':
      return diff % 14 === 0;
    case 'semimonthly': {
      const startDay = start.getDate();
      const checkDay = check.getDate();
      const daysInMonth = new Date(check.getFullYear(), check.getMonth() + 1, 0).getDate();
      const secondDay = Math.min(startDay + 15, daysInMonth);
      return checkDay === startDay || checkDay === secondDay;
    }
    case 'monthly':
      return check.getDate() === start.getDate();
    case 'yearly':
      return check.getMonth() === start.getMonth() && check.getDate() === start.getDate();
  }
}

/**
 * Returns the next occurrence on or after `fromDate`.
 * Returns null if no occurrence found within 1 year.
 */
export function nextOccurrenceOnOrAfter(
  startDate: Date,
  freq: RepeatFrequency,
  fromDate: Date,
): Date | null {
  const start = startOfDay(startDate);
  const from = startOfDay(fromDate);
  let candidate = start >= from ? start : from;
  for (let i = 0; i < 366; i++) {
    if (isScheduledOn(start, freq, candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return null;
}

// ── Calendar view aggregation ────────────────────────────────────────────────

export type CalendarView = 'today' | 'week' | 'month' | 'year';

export interface CalendarEntry {
  /** _id of the TodoOccurrence document (undefined for legacy/offline entries). */
  occurrenceId?: string;
  listId: string;
  listName: string;
  item: import('../models/list.model').ListItem;
  dueDate: Date | null;
  /** true = main window (e.g. "this week"), false = secondary upcoming window */
  isPrimary: boolean;
  /** true = list has no due date — always shown at the bottom */
  isUndated: boolean;
  /** true = this particular occurrence has been completed by the user today */
  isOccurrenceCompleted: boolean;
  /** YYYY-MM-DD of the occurrence being represented (for toggle calls). */
  occurrenceDateStr: string;
  repeatFrequency?: RepeatFrequency;
}

/** Format a Date to YYYY-MM-DD local date string */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Builds calendar entries for all incomplete (and occurrence-completed) items
 * across todo lists.
 *
 * Recurring lists  → shows every non-permanently-completed item; marks
 *   `isOccurrenceCompleted = true` when `item.lastCompletedAt === occurrenceDate`.
 *   Completed items appear crossed-out at the bottom of their section and will
 *   re-appear on the next occurrence date.
 *
 * Non-recurring / undated → same, using `item.lastCompletedAt === occurrenceDate`.
 */
export function buildCalendarEntries(lists: UserList[], view: CalendarView): CalendarEntry[] {
  const today = startOfDay(new Date());
  const todayStr = toDateStr(today);
  const entries: CalendarEntry[] = [];

  for (const list of lists) {
    if (list.listType !== 'todo') continue;

    // For recurring lists every occurrence is independent — ignore item.completed
    // so a daily item checked off yesterday still shows today.
    // For non-recurring lists, respect the permanent completed flag.
    const pending = list.repeatFrequency ? list.items : list.items.filter((i) => !i.completed);
    if (pending.length === 0) continue;

    // ── Undated list ──────────────────────────────────────────────────────
    if (!list.completeByDate) {
      for (const item of pending) {
        entries.push({
          listId: list._id!,
          listName: list.name,
          item,
          dueDate: null,
          isPrimary: false,
          isUndated: true,
          isOccurrenceCompleted: item.lastCompletedAt === todayStr,
          occurrenceDateStr: todayStr,
        });
      }
      continue;
    }

    const startDate = startOfDay(new Date(list.completeByDate));
    const candidateDue: Date | null = list.repeatFrequency
      ? nextOccurrenceOnOrAfter(startDate, list.repeatFrequency, today)
      : startDate;

    if (!candidateDue) continue;

    const offset = daysBetween(today, candidateDue);
    const occurrenceDateStr = toDateStr(candidateDue);

    let isPrimary: boolean;

    switch (view) {
      case 'today':
        if (offset <= 0) {
          isPrimary = true;
        } else if (offset <= 7) {
          isPrimary = false;
        } else continue;
        break;

      case 'week':
        if (offset < 0 || offset <= 6) {
          isPrimary = true;
        } else if (offset <= 13) {
          isPrimary = false;
        } else continue;
        break;

      case 'month': {
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        const dueMs = candidateDue.getTime();
        if (offset < 0) {
          isPrimary = true;
        } else if (
          candidateDue.getFullYear() === today.getFullYear() &&
          candidateDue.getMonth() === today.getMonth()
        ) {
          isPrimary = true;
        } else if (dueMs >= nextMonthStart.getTime() && dueMs <= nextMonthEnd.getTime()) {
          isPrimary = false;
        } else {
          continue;
        }
        break;
      }

      case 'year':
        if (candidateDue.getFullYear() !== today.getFullYear()) continue;
        isPrimary = true;
        break;

      default:
        continue;
    }

    for (const item of pending) {
      entries.push({
        listId: list._id!,
        listName: list.name,
        item,
        dueDate: candidateDue,
        isPrimary,
        isUndated: false,
        isOccurrenceCompleted: item.lastCompletedAt === occurrenceDateStr,
        occurrenceDateStr,
        repeatFrequency: list.repeatFrequency,
      });
    }
  }

  // Sort: undated last, then by section, then incomplete before completed,
  // then by dueDate ascending within group
  entries.sort((a, b) => {
    if (a.isUndated !== b.isUndated) return a.isUndated ? 1 : -1;
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isOccurrenceCompleted !== b.isOccurrenceCompleted)
      return a.isOccurrenceCompleted ? 1 : -1;
    const aT = a.dueDate?.getTime() ?? 0;
    const bT = b.dueDate?.getTime() ?? 0;
    return aT - bT;
  });

  return entries;
}

// ── Daily view aggregation ────────────────────────────────────────────────────

export type DueStatus = 'overdue' | 'today' | 'soon' | 'undated';

export interface DailyTodoEntry {
  listId: string;
  listName: string;
  item: import('../models/list.model').ListItem;
  dueStatus: DueStatus;
  /** Days offset: negative = overdue, positive = days until due. */
  daysOffset: number;
  nextDue: Date | null;
  /** The list's repeat frequency, if any. */
  repeatFrequency?: RepeatFrequency;
}

/**
 * Aggregates all incomplete todo items across lists into daily view entries.
 * The schedule (completeByDate + repeatFrequency) is read from the LIST,
 * not from individual items.
 *
 * - overdue: list has a one-time due date in the past
 * - today: list is scheduled today (one-time or recurrence)
 * - soon: list is due within 1–7 days
 * - undated: list has no completeByDate
 */
export function buildDailyTodoEntries(lists: UserList[]): DailyTodoEntry[] {
  const today = startOfDay(new Date());
  const entries: DailyTodoEntry[] = [];

  for (const list of lists) {
    if (list.listType !== 'todo') continue;

    // Determine the list's status for today
    let listDueStatus: DueStatus;
    let listDaysOffset = 0;
    let listNextDue: Date | null = null;

    if (!list.completeByDate) {
      listDueStatus = 'undated';
    } else {
      const dueDate = startOfDay(new Date(list.completeByDate));

      if (list.repeatFrequency) {
        if (isScheduledOn(dueDate, list.repeatFrequency, today)) {
          listDueStatus = 'today';
          listNextDue = today;
        } else {
          const next = nextOccurrenceOnOrAfter(dueDate, list.repeatFrequency, addDays(today, 1));
          if (next && daysBetween(today, next) <= 7) {
            listDueStatus = 'soon';
            listDaysOffset = daysBetween(today, next);
            listNextDue = next;
          } else {
            continue; // not relevant soon enough
          }
        }
      } else {
        const offset = daysBetween(today, dueDate);
        if (offset < 0) {
          listDueStatus = 'overdue';
          listDaysOffset = offset;
          listNextDue = dueDate;
        } else if (offset === 0) {
          listDueStatus = 'today';
          listNextDue = today;
        } else if (offset <= 7) {
          listDueStatus = 'soon';
          listDaysOffset = offset;
          listNextDue = dueDate;
        } else {
          continue; // not due soon
        }
      }
    }

    // Add all incomplete items from this list with the list's status
    for (const item of list.items) {
      if (item.completed) continue;
      entries.push({
        listId: list._id!,
        listName: list.name,
        item,
        dueStatus: listDueStatus,
        daysOffset: listDaysOffset,
        nextDue: listNextDue,
        repeatFrequency: list.repeatFrequency,
      });
    }
  }

  // Sort: overdue first (most overdue), then today, soon, undated
  return entries.sort((a, b) => {
    const order: Record<DueStatus, number> = { overdue: 0, today: 1, soon: 2, undated: 3 };
    if (order[a.dueStatus] !== order[b.dueStatus]) return order[a.dueStatus] - order[b.dueStatus];
    return a.daysOffset - b.daysOffset;
  });
}
