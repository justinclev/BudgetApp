export interface SubItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export type RepeatFrequency =
  | 'daily'
  | 'every-other-day'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'yearly';

export const REPEAT_FREQUENCY_LABELS: Record<RepeatFrequency, string> = {
  daily: 'Daily',
  'every-other-day': 'Every Other Day',
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  semimonthly: 'Semi-Monthly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  /** YYYY-MM-DD of the most recently completed recurrence occurrence (calendar-only toggle). */
  lastCompletedAt?: string;
  lastCompletedBy?: string;
  createdAt: string;
  subItems: SubItem[];
}

export type ListType = 'shopping' | 'todo' | 'other';

export interface UserList {
  _id?: string;
  name: string;
  listType: ListType;
  ownerId: string;
  authorizedUsers: string[];
  items: ListItem[];
  shareToken: string;
  createdAt: string;
  completeByDate?: string;
  repeatFrequency?: RepeatFrequency;
}

export interface CreateListRequest {
  name: string;
  listType: ListType;
  ownerId: string;
  completeByDate?: string;
  repeatFrequency?: string;
}

export interface AddItemRequest {
  text: string;
}

export interface UpdateItemRequest {
  text: string;
}

export interface UpdateListRequest {
  name: string;
  listType: ListType;
  completeByDate?: string;
  repeatFrequency?: string;
}

export interface JoinListRequest {
  userId: string;
}

/** A concrete calendar occurrence stored in the `todo_occurrences` collection. */
export interface TodoOccurrence {
  _id: string;
  listId: string;
  itemId: string;
  itemText: string;
  listName: string;
  /** YYYY-MM-DD of this occurrence. */
  occurrenceDate: string;
  completed: boolean;
  completedByUserId?: string;
  completedAt?: string;
  ownerId: string;
  repeatFrequency?: RepeatFrequency;
  /** YYYY-MM-DD of the list's original completeByDate. Undefined = undated list. */
  listDueDate?: string;
  createdAt: string;
}
