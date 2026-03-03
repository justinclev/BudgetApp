import { Component, Input, OnChanges, Output, EventEmitter, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  UserList,
  SubItem,
  TodoOccurrence,
  REPEAT_FREQUENCY_LABELS,
  RepeatFrequency,
} from '../../models/list.model';
import { ListService } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { CalendarView, CalendarEntry } from '../../utils/todo-recurrence';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss',
})
export class CalendarViewComponent implements OnChanges {
  @Input() lists: UserList[] = [];
  /** Kept for interface compatibility with home component — not emitted for occurrence toggles. */
  @Output() listUpdated = new EventEmitter<UserList>();

  selectedView = signal<CalendarView>('today');
  private entries = signal<CalendarEntry[]>([]);
  loading = signal(false);

  today = new Date();

  readonly views: { key: CalendarView; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];

  primary = computed(() => this.entries().filter((e) => !e.isUndated && e.isPrimary));
  secondary = computed(() => this.entries().filter((e) => !e.isUndated && !e.isPrimary));
  undated = computed(() => this.entries().filter((e) => e.isUndated));

  hasAny = computed(() => this.entries().length > 0);

  primaryHeading = computed<string>(() => {
    switch (this.selectedView()) {
      case 'today':
        return '🔴 Due Today & Overdue';
      case 'week':
        return '📅 Due This Week';
      case 'month':
        return '📅 Due This Month';
      case 'year':
        return '📅 Due This Year';
    }
  });

  secondaryHeading = computed<string>(() => {
    switch (this.selectedView()) {
      case 'today':
        return '🔜 Due This Week';
      case 'week':
        return '🔜 Due Next Week';
      case 'month':
        return '🔜 Due Next Month';
      default:
        return '';
    }
  });

  constructor(
    private router: Router,
    private listService: ListService,
    private auth: AuthService,
  ) {}

  ngOnChanges(): void {
    this.generateAndLoad();
  }

  selectView(view: CalendarView): void {
    this.selectedView.set(view);
    this.generateAndLoad();
  }

  // ── Data loading ────────────────────────────────────────────────────────

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private dateRange(): { startDate: string; endDate: string } {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const add = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
    const start = this.toDateStr(now);
    let end: string;
    switch (this.selectedView()) {
      case 'today':
        end = this.toDateStr(add(now, 7));
        break;
      case 'week':
        end = this.toDateStr(add(now, 14));
        break;
      case 'month':
        end = this.toDateStr(new Date(now.getFullYear(), now.getMonth() + 2, 0));
        break;
      case 'year':
        end = this.toDateStr(new Date(now.getFullYear(), 11, 31));
        break;
      default:
        end = this.toDateStr(add(now, 14));
    }
    return { startDate: start, endDate: end };
  }

  private generateAndLoad(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const { startDate, endDate } = this.dateRange();
    this.loading.set(true);

    this.listService
      .generateOccurrences(userId, startDate, endDate)
      .pipe(switchMap(() => this.listService.getOccurrences(userId, startDate, endDate)))
      .subscribe({
        next: (occurrences) => {
          this.entries.set(this.mapToEntries(occurrences));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private parseLocalDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private mapToEntries(occurrences: TodoOccurrence[]): CalendarEntry[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const view = this.selectedView();

    // Deduplicate repeating items: for each unique (listId, itemId) keep only the
    // single most-relevant occurrence.
    // Rules (in order):
    //   1. A completed occurrence for TODAY always wins — it was scratched off today
    //      and must remain visible (with who did it) for the rest of the day.
    //   2. Prefer incomplete over completed (find the next actionable instance).
    //   3. Among same state, prefer earliest upcoming; fall back to least overdue.
    const best = new Map<string, TodoOccurrence>();
    for (const occ of occurrences) {
      const key = `${occ.listId}-${occ.itemId}`;
      const existing = best.get(key);
      if (!existing) {
        best.set(key, occ);
        continue;
      }
      const occDate = this.parseLocalDate(occ.occurrenceDate);
      const existDate = this.parseLocalDate(existing.occurrenceDate);
      const occOffset = Math.round((occDate.getTime() - now.getTime()) / 86_400_000);
      const existOffset = Math.round((existDate.getTime() - now.getTime()) / 86_400_000);

      // Rule 1: today-completed is sacred — never replace it
      if (existing.completed && existOffset === 0) { continue; }
      if (occ.completed && occOffset === 0) { best.set(key, occ); continue; }

      // Rule 2: prefer incomplete over completed
      if (!occ.completed && existing.completed) { best.set(key, occ); continue; }
      if (occ.completed && !existing.completed) { continue; }

      // Rule 3: both same state — prefer earliest upcoming, then least overdue
      const occIsUpcoming = occOffset >= 0;
      const existIsUpcoming = existOffset >= 0;
      if (occIsUpcoming && !existIsUpcoming) { best.set(key, occ); continue; }
      if (!occIsUpcoming && existIsUpcoming) { continue; }
      if (Math.abs(occOffset) < Math.abs(existOffset)) { best.set(key, occ); }
    }
    const deduped = Array.from(best.values());

    const entries: CalendarEntry[] = deduped.map((occ) => {
      const isUndated = !occ.listDueDate;
      const occDate = this.parseLocalDate(occ.occurrenceDate);
      const offset = Math.round((occDate.getTime() - now.getTime()) / 86_400_000);

      let isPrimary = true;
      if (!isUndated) {
        switch (view) {
          case 'today':
            isPrimary = offset <= 0;
            break;
          case 'week':
            isPrimary = offset >= 0 && offset <= 6;
            break;
          case 'month':
            isPrimary =
              occDate.getFullYear() === now.getFullYear() && occDate.getMonth() === now.getMonth();
            break;
          case 'year':
            isPrimary = true;
            break;
        }
      }

      // Look up real ListItem from the lists input to get actual subItems
      const realItem = this.lists
        .find((l) => l._id === occ.listId)
        ?.items.find((i) => i.id === occ.itemId);

      return {
        occurrenceId: occ._id,
        listId: occ.listId,
        listName: occ.listName,
        item: {
          id: occ.itemId,
          text: occ.itemText,
          completed: occ.completed,
          createdAt: '',
          subItems: realItem?.subItems ?? [],
        } as any,
        dueDate: isUndated ? null : occDate,
        isPrimary,
        isUndated,
        isOccurrenceCompleted: occ.completed,
        completedBy: occ.completedByName ?? occ.completedByUserId,
        occurrenceDateStr: occ.occurrenceDate,
        repeatFrequency: occ.repeatFrequency as RepeatFrequency | undefined,
      };
    });

    entries.sort((a, b) => {
      if (a.isUndated !== b.isUndated) return a.isUndated ? 1 : -1;
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.isOccurrenceCompleted !== b.isOccurrenceCompleted)
        return a.isOccurrenceCompleted ? 1 : -1;
      return (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0);
    });

    return entries;
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  toggleItem(entry: CalendarEntry, event: Event): void {
    event.stopPropagation();
    if (!entry.occurrenceId) return;
    const userId = this.auth.user()?.id;

    this.listService.toggleOccurrence(entry.occurrenceId, userId).subscribe({
      next: (updated: TodoOccurrence) => {
        const completedBy = updated.completedByName ?? updated.completedByUserId;
        this.entries.update((all) =>
          all
            .map((e) =>
              e.occurrenceId === entry.occurrenceId
                ? { ...e, isOccurrenceCompleted: updated.completed, completedBy: updated.completed ? completedBy : undefined }
                : e,
            )
            .sort((a, b) => {
              if (a.isUndated !== b.isUndated) return a.isUndated ? 1 : -1;
              if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
              if (a.isOccurrenceCompleted !== b.isOccurrenceCompleted)
                return a.isOccurrenceCompleted ? 1 : -1;
              return (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0);
            }),
        );
      },
    });
  }

  toggleSubItem(entry: CalendarEntry, subItem: SubItem, event: Event): void {
    event.stopPropagation();
    const userId = this.auth.user()?.id;
    this.listService.toggleSubItem(entry.listId, entry.item.id, subItem.id, userId).subscribe({
      next: (updatedList: UserList) => {
        const updatedItem = updatedList.items.find((i) => i.id === entry.item.id);
        if (!updatedItem) return;
        this.entries.update((all) =>
          all.map((e) =>
            e.occurrenceId === entry.occurrenceId
              ? { ...e, item: { ...e.item, subItems: updatedItem.subItems } }
              : e,
          ),
        );
      },
    });
  }

  openList(entry: CalendarEntry, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/list', entry.listId]);
  }

  dueDateLabel(entry: CalendarEntry): string {
    if (!entry.dueDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(entry.dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  }

  completedByLabel(entry: CalendarEntry): string {
    if (!entry.completedBy) return '';
    const currentUserId = this.auth.user()?.id;
    if (entry.completedBy === currentUserId) return 'You';
    return entry.completedBy;
  }

  repeatLabel(entry: CalendarEntry): string {
    return entry.repeatFrequency ? REPEAT_FREQUENCY_LABELS[entry.repeatFrequency] : '';
  }

  trackEntry(_i: number, e: CalendarEntry): string {
    return e.occurrenceId ?? `${e.listId}-${e.item.id}`;
  }
}
