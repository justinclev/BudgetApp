import { Component, Input, computed, signal, OnChanges } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { UserList } from '../../models/list.model';
import { REPEAT_FREQUENCY_LABELS } from '../../models/list.model';
import { buildDailyTodoEntries, DailyTodoEntry, DueStatus } from '../../utils/todo-recurrence';

@Component({
  selector: 'app-daily-todo',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './daily-todo.component.html',
  styleUrl: './daily-todo.component.scss',
})
export class DailyTodoComponent implements OnChanges {
  @Input() lists: UserList[] = [];

  private router;

  constructor(router: Router) {
    this.router = router;
  }

  entries = signal<DailyTodoEntry[]>([]);

  ngOnChanges(): void {
    this.entries.set(buildDailyTodoEntries(this.lists));
  }

  todayDate = new Date();

  overdue = computed(() => this.entries().filter((e) => e.dueStatus === 'overdue'));
  todayEntries = computed(() => this.entries().filter((e) => e.dueStatus === 'today'));
  soon = computed(() => this.entries().filter((e) => e.dueStatus === 'soon'));
  undated = computed(() => this.entries().filter((e) => e.dueStatus === 'undated'));

  hasTodoLists = computed(() => this.lists.some((l) => l.listType === 'todo'));
  totalCount = computed(() => this.overdue().length + this.todayEntries().length);

  repeatLabel(entry: DailyTodoEntry): string {
    const f = entry.repeatFrequency;
    return f ? REPEAT_FREQUENCY_LABELS[f] : '';
  }

  overdueLabel(entry: DailyTodoEntry): string {
    const days = Math.abs(entry.daysOffset);
    return days === 1 ? '1 day overdue' : `${days} days overdue`;
  }

  soonLabel(entry: DailyTodoEntry): string {
    return entry.daysOffset === 1 ? 'Tomorrow' : `In ${entry.daysOffset} days`;
  }

  goToList(listId: string): void {
    this.router.navigate(['/list', listId]);
  }

  trackEntry(_i: number, e: DailyTodoEntry): string {
    return `${e.listId}-${e.item.id}`;
  }
}
