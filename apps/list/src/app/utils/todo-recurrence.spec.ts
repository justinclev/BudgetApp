import {
  isScheduledOn,
  nextOccurrenceOnOrAfter,
  buildCalendarEntries,
  buildDailyTodoEntries,
  CalendarView,
} from './todo-recurrence';
import { UserList, ListItem, RepeatFrequency } from '../models/list.model';

// ── Helpers ────────────────────────────────────────────────────────────────

function d(dateStr: string): Date {
  // Produce a LOCAL midnight date to avoid off-by-one from UTC drift
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

function item(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'i1',
    text: 'Task',
    completed: false,
    createdAt: '2024-01-01',
    subItems: [],
    ...overrides,
  };
}

function todoList(overrides: Partial<UserList> = {}): UserList {
  return {
    _id: 'list1',
    name: 'Test List',
    listType: 'todo',
    ownerId: 'u1',
    authorizedUsers: ['u1'],
    items: [item()],
    shareToken: 'tok',
    createdAt: '2024-01-01',
    ...overrides,
  };
}

// ── isScheduledOn ──────────────────────────────────────────────────────────

describe('isScheduledOn', () => {
  const start = d('2024-01-01');

  describe('daily', () => {
    it('is true on the start date', () =>
      expect(isScheduledOn(start, 'daily', d('2024-01-01'))).toBeTrue());
    it('is true the next day', () =>
      expect(isScheduledOn(start, 'daily', d('2024-01-02'))).toBeTrue());
    it('is true 100 days later', () =>
      expect(isScheduledOn(start, 'daily', d('2024-04-10'))).toBeTrue());
    it('is false before the start date', () =>
      expect(isScheduledOn(start, 'daily', d('2023-12-31'))).toBeFalse());
  });

  describe('every-other-day', () => {
    it('is true on day 0 (start)', () =>
      expect(isScheduledOn(start, 'every-other-day', d('2024-01-01'))).toBeTrue());
    it('is false on day 1', () =>
      expect(isScheduledOn(start, 'every-other-day', d('2024-01-02'))).toBeFalse());
    it('is true on day 2', () =>
      expect(isScheduledOn(start, 'every-other-day', d('2024-01-03'))).toBeTrue());
    it('is true on day 4', () =>
      expect(isScheduledOn(start, 'every-other-day', d('2024-01-05'))).toBeTrue());
  });

  describe('weekly', () => {
    it('is true on the start date', () =>
      expect(isScheduledOn(start, 'weekly', d('2024-01-01'))).toBeTrue());
    it('is false 3 days later', () =>
      expect(isScheduledOn(start, 'weekly', d('2024-01-04'))).toBeFalse());
    it('is true exactly 7 days later', () =>
      expect(isScheduledOn(start, 'weekly', d('2024-01-08'))).toBeTrue());
    it('is true 14 days later', () =>
      expect(isScheduledOn(start, 'weekly', d('2024-01-15'))).toBeTrue());
    it('is false 8 days later', () =>
      expect(isScheduledOn(start, 'weekly', d('2024-01-09'))).toBeFalse());
  });

  describe('biweekly', () => {
    it('is true on start', () =>
      expect(isScheduledOn(start, 'biweekly', d('2024-01-01'))).toBeTrue());
    it('is false 7 days later', () =>
      expect(isScheduledOn(start, 'biweekly', d('2024-01-08'))).toBeFalse());
    it('is true 14 days later', () =>
      expect(isScheduledOn(start, 'biweekly', d('2024-01-15'))).toBeTrue());
    it('is false 15 days later', () =>
      expect(isScheduledOn(start, 'biweekly', d('2024-01-16'))).toBeFalse());
    it('is true 28 days later', () =>
      expect(isScheduledOn(start, 'biweekly', d('2024-01-29'))).toBeTrue());
  });

  describe('monthly', () => {
    it('is true on same day next month', () =>
      expect(isScheduledOn(start, 'monthly', d('2024-02-01'))).toBeTrue());
    it('is false on different day of the month', () =>
      expect(isScheduledOn(start, 'monthly', d('2024-02-15'))).toBeFalse());
    it('is true same day each month for a year', () => {
      for (let m = 1; m <= 12; m++) {
        const check = new Date(2024, m - 1, 1);
        expect(isScheduledOn(start, 'monthly', check)).toBeTrue();
      }
    });
  });

  describe('yearly', () => {
    it('is true on the same day next year', () =>
      expect(isScheduledOn(start, 'yearly', d('2025-01-01'))).toBeTrue());
    it('is false on same month different day', () =>
      expect(isScheduledOn(start, 'yearly', d('2025-01-15'))).toBeFalse());
    it('is false on different month same day', () =>
      expect(isScheduledOn(start, 'yearly', d('2025-03-01'))).toBeFalse());
    it('is true 3 years later on exact date', () =>
      expect(isScheduledOn(start, 'yearly', d('2027-01-01'))).toBeTrue());
  });

  describe('semimonthly', () => {
    const smStart = d('2024-01-05');
    it('is true on start day (day 5)', () =>
      expect(isScheduledOn(smStart, 'semimonthly', d('2024-01-05'))).toBeTrue());
    it('is true on second occurrence (day 20 = 5+15)', () =>
      expect(isScheduledOn(smStart, 'semimonthly', d('2024-01-20'))).toBeTrue());
    it('is false on random day', () =>
      expect(isScheduledOn(smStart, 'semimonthly', d('2024-01-10'))).toBeFalse());
    it('caps second day at end of month for late start dates', () => {
      const lateStart = d('2024-01-20');
      // 20+15=35 → capped to 31 (Jan has 31 days)
      expect(isScheduledOn(lateStart, 'semimonthly', d('2024-01-31'))).toBeTrue();
    });
  });
});

// ── nextOccurrenceOnOrAfter ────────────────────────────────────────────────

describe('nextOccurrenceOnOrAfter', () => {
  const start = d('2024-01-01');

  it('returns start date if fromDate === start', () =>
    expect(nextOccurrenceOnOrAfter(start, 'daily', d('2024-01-01'))?.toDateString()).toBe(
      d('2024-01-01').toDateString(),
    ));

  it('returns the correct next weekly occurrence', () => {
    const result = nextOccurrenceOnOrAfter(start, 'weekly', d('2024-01-02'));
    expect(result?.toDateString()).toBe(d('2024-01-08').toDateString());
  });

  it('returns same date for daily when fromDate is after start', () => {
    const result = nextOccurrenceOnOrAfter(start, 'daily', d('2024-06-15'));
    expect(result?.toDateString()).toBe(d('2024-06-15').toDateString());
  });

  it('returns the next monthly occurrence', () => {
    const result = nextOccurrenceOnOrAfter(start, 'monthly', d('2024-01-02'));
    expect(result?.toDateString()).toBe(d('2024-02-01').toDateString());
  });

  it('returns the start date itself if fromDate is before start daily', () => {
    const result = nextOccurrenceOnOrAfter(start, 'daily', d('2023-12-01'));
    expect(result?.toDateString()).toBe(start.toDateString());
  });

  it('returns next yearly occurrence correctly', () => {
    const result = nextOccurrenceOnOrAfter(start, 'yearly', d('2024-01-02'));
    expect(result?.toDateString()).toBe(d('2025-01-01').toDateString());
  });

  it('returns biweekly occurrence skipping midpoint', () => {
    const result = nextOccurrenceOnOrAfter(start, 'biweekly', d('2024-01-09'));
    expect(result?.toDateString()).toBe(d('2024-01-15').toDateString());
  });
});

// ── buildDailyTodoEntries ──────────────────────────────────────────────────

describe('buildDailyTodoEntries', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /**
   * Produce a datetime string that the implementation parses as local midnight.
   * Using T00:00:00 (no Z) ensures browsers parse it as local time, not UTC.
   */
  function toCompleteByDate(local: Date): string {
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, '0');
    const day = String(local.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00`;
  }

  function todayStr(): string {
    return toCompleteByDate(today);
  }

  it('skips non-todo lists', () => {
    const list = todoList({ listType: 'shopping' });
    expect(buildDailyTodoEntries([list])).toEqual([]);
  });

  it('skips completed items', () => {
    const list = todoList({ items: [item({ completed: true })] });
    expect(buildDailyTodoEntries([list])).toEqual([]);
  });

  it('returns undated entry for list without completeByDate', () => {
    const list = todoList({ completeByDate: undefined });
    const entries = buildDailyTodoEntries([list]);
    expect(entries.length).toBe(1);
    expect(entries[0].dueStatus).toBe('undated');
  });

  it('returns today entry for list due today', () => {
    const list = todoList({ completeByDate: todayStr() });
    const entries = buildDailyTodoEntries([list]);
    expect(entries.length).toBe(1);
    expect(entries[0].dueStatus).toBe('today');
  });

  it('returns overdue entry for past due date', () => {
    const past = new Date(today);
    past.setDate(past.getDate() - 3);
    const pastStr = toCompleteByDate(past);
    const list = todoList({ completeByDate: pastStr });
    const entries = buildDailyTodoEntries([list]);
    expect(entries.length).toBe(1);
    expect(entries[0].dueStatus).toBe('overdue');
    expect(entries[0].daysOffset).toBeLessThan(0);
  });

  it('returns soon entry for list due in 3 days', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 3);
    const futureStr = toCompleteByDate(future);
    const list = todoList({ completeByDate: futureStr });
    const entries = buildDailyTodoEntries([list]);
    expect(entries.length).toBe(1);
    expect(entries[0].dueStatus).toBe('soon');
    expect(entries[0].daysOffset).toBe(3);
  });

  it('ignores list due more than 7 days away', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 10);
    const futureStr = toCompleteByDate(future);
    const list = todoList({ completeByDate: futureStr });
    expect(buildDailyTodoEntries([list])).toEqual([]);
  });

  it('sorts overdue before today before soon before undated', () => {
    const past = new Date(today);
    past.setDate(past.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);

    const lists = [
      todoList({ _id: 'undated', completeByDate: undefined }),
      todoList({ _id: 'soon', completeByDate: toCompleteByDate(tomorrow) }),
      todoList({ _id: 'today', completeByDate: todayStr() }),
      todoList({ _id: 'overdue', completeByDate: toCompleteByDate(past) }),
    ];

    const entries = buildDailyTodoEntries(lists);
    const statuses = entries.map((e) => e.dueStatus);
    const overdueIdx = statuses.indexOf('overdue');
    const todayIdx = statuses.indexOf('today');
    const soonIdx = statuses.indexOf('soon');
    const undatedIdx = statuses.indexOf('undated');
    expect(overdueIdx).toBeLessThan(todayIdx);
    expect(todayIdx).toBeLessThan(soonIdx);
    expect(soonIdx).toBeLessThan(undatedIdx);
  });

  it('daily recurring list — returns today entry', () => {
    const list = todoList({
      completeByDate: todayStr(),
      repeatFrequency: 'daily',
    });
    const entries = buildDailyTodoEntries([list]);
    expect(entries.length).toBe(1);
    expect(entries[0].dueStatus).toBe('today');
    expect(entries[0].repeatFrequency).toBe('daily');
  });

  it('includes multiple items per list', () => {
    const list = todoList({
      items: [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })],
      completeByDate: todayStr(),
    });
    expect(buildDailyTodoEntries([list]).length).toBe(3);
  });
});

// ── buildCalendarEntries ──────────────────────────────────────────────────

describe('buildCalendarEntries', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /**
   * Produce a datetime string that the implementation parses as local midnight.
   * Using T00:00:00 (no Z) ensures browsers parse it as local time, not UTC.
   */
  function toCompleteByDate(local: Date): string {
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, '0');
    const day = String(local.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00`;
  }

  function fmt(d: Date): string {
    return toCompleteByDate(d);
  }

  /** Local YYYY-MM-DD for use in lastCompletedAt (matches impl's toDateStr) */
  function localDateStr(local: Date): string {
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  }

  it('skips non-todo lists', () => {
    const list = todoList({ listType: 'shopping' });
    expect(buildCalendarEntries([list], 'today')).toEqual([]);
  });

  it('skips lists with 0 pending items', () => {
    const list = todoList({ items: [item({ completed: true })] });
    expect(buildCalendarEntries([list], 'today')).toEqual([]);
  });

  it('builds undated entries for list without completeByDate', () => {
    const list = todoList({ completeByDate: undefined });
    const entries = buildCalendarEntries([list], 'today');
    expect(entries.length).toBe(1);
    expect(entries[0].isUndated).toBeTrue();
    expect(entries[0].isPrimary).toBeFalse();
    expect(entries[0].dueDate).toBeNull();
  });

  it('today view — marks item due today as primary', () => {
    const list = todoList({ completeByDate: fmt(today) });
    const entries = buildCalendarEntries([list], 'today');
    expect(entries.length).toBe(1);
    expect(entries[0].isPrimary).toBeTrue();
  });

  it('today view — marks item due in 5 days as non-primary', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    const list = todoList({ completeByDate: fmt(future) });
    const entries = buildCalendarEntries([list], 'today');
    expect(entries.length).toBe(1);
    expect(entries[0].isPrimary).toBeFalse();
  });

  it('today view — excludes items due more than 7 days away', () => {
    const far = new Date(today);
    far.setDate(far.getDate() + 10);
    const list = todoList({ completeByDate: fmt(far) });
    expect(buildCalendarEntries([list], 'today')).toEqual([]);
  });

  it('week view — includes item due in 6 days as primary', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 6);
    const list = todoList({ completeByDate: fmt(future) });
    const entries = buildCalendarEntries([list], 'week');
    expect(entries.length).toBe(1);
    expect(entries[0].isPrimary).toBeTrue();
  });

  it('week view — item due in 10 days is secondary', () => {
    const future = new Date(today);
    future.setDate(future.getDate() + 10);
    const list = todoList({ completeByDate: fmt(future) });
    const entries = buildCalendarEntries([list], 'week');
    expect(entries.length).toBe(1);
    expect(entries[0].isPrimary).toBeFalse();
  });

  it('year view — excludes list due next year', () => {
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    nextYear.setDate(1);
    nextYear.setMonth(0);
    const list = todoList({ completeByDate: fmt(nextYear) });
    expect(buildCalendarEntries([list], 'year')).toEqual([]);
  });

  it('year view — includes list due this year', () => {
    // Use a date guaranteed to be in this year and reasonably in the future
    const endOfYear = new Date(today.getFullYear(), 11, 28); // Dec 28 this year
    const list = todoList({ completeByDate: fmt(endOfYear) });
    const entries = buildCalendarEntries([list], 'year');
    expect(entries.length).toBe(1);
  });

  it('marks isOccurrenceCompleted when lastCompletedAt matches occurrence date', () => {
    const todayCompleteBy = fmt(today);
    const todayOccurrenceStr = localDateStr(today);
    const list = todoList({
      completeByDate: todayCompleteBy,
      items: [item({ lastCompletedAt: todayOccurrenceStr })],
    });
    const entries = buildCalendarEntries([list], 'today');
    expect(entries[0].isOccurrenceCompleted).toBeTrue();
  });

  it('marks isOccurrenceCompleted false when lastCompletedAt does not match', () => {
    const todayCompleteBy = fmt(today);
    const list = todoList({
      completeByDate: todayCompleteBy,
      items: [item({ lastCompletedAt: '2000-01-01' })],
    });
    const entries = buildCalendarEntries([list], 'today');
    expect(entries[0].isOccurrenceCompleted).toBeFalse();
  });

  it('recurring list — shows non-permanently-completed items', () => {
    const list = todoList({
      completeByDate: fmt(today),
      repeatFrequency: 'daily',
      items: [item({ completed: true })], // permanently completed but recurring → still show
    });
    const entries = buildCalendarEntries([list], 'today');
    expect(entries.length).toBe(1);
  });

  it('sorts undated entries after dated entries', () => {
    const dated = todoList({ _id: 'dated', completeByDate: fmt(today) });
    const undated = todoList({ _id: 'undated', completeByDate: undefined });
    const entries = buildCalendarEntries([undated, dated], 'today');
    const ids = entries.map((e) => e.listId);
    expect(ids.indexOf('dated')).toBeLessThan(ids.indexOf('undated'));
  });
});
