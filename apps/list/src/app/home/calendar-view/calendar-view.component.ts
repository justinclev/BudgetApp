import { Component, Input, OnChanges, Output, EventEmitter, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  UserList,
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

    const entries: CalendarEntry[] = occurrences.map((occ) => {
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

      return {
        occurrenceId: occ._id,
        listId: occ.listId,
        listName: occ.listName,
        // Minimal ListItem shape — calendar only uses id and text
        item: {
          id: occ.itemId,
          text: occ.itemText,
          completed: occ.completed,
          createdAt: '',
          subItems: [],
        } as any,
        dueDate: isUndated ? null : occDate,
        isPrimary,
        isUndated,
        isOccurrenceCompleted: occ.completed,
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
        this.entries.update((all) =>
          all
            .map((e) =>
              e.occurrenceId === entry.occurrenceId
                ? { ...e, isOccurrenceCompleted: updated.completed }
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

  repeatLabel(entry: CalendarEntry): string {
    return entry.repeatFrequency ? REPEAT_FREQUENCY_LABELS[entry.repeatFrequency] : '';
  }

  trackEntry(_i: number, e: CalendarEntry): string {
    return e.occurrenceId ?? `${e.listId}-${e.item.id}`;
  }
}
