import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ListService } from '../services/list.service';
import { UserList, REPEAT_FREQUENCY_LABELS, RepeatFrequency } from '../models/list.model';
import {
  CreateListModalComponent,
  CreateListForm,
} from './create-list-modal/create-list-modal.component';
import { CalendarViewComponent } from './calendar-view/calendar-view.component';
import { VoiceSettingsComponent } from './voice-settings/voice-settings.component';

type Tab = 'lists' | 'todos' | 'schedule';
type Filter = 'all' | 'todo' | 'shopping' | 'other';

const TYPE_GRADIENTS: Record<string, string> = {
  shopping: 'linear-gradient(160deg, #f59e0b, #f97316)',
  todo: 'linear-gradient(160deg, #10b981, #059669)',
  other: 'linear-gradient(160deg, #8b5cf6, #6d28d9)',
};
const TYPE_COLORS: Record<string, string> = {
  shopping: '#f59e0b',
  todo: '#10b981',
  other: '#8b5cf6',
};
const TYPE_EMOJI: Record<string, string> = {
  shopping: '🛒',
  todo: '✅',
  other: '📝',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DatePipe, CreateListModalComponent, CalendarViewComponent, VoiceSettingsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private auth = inject(AuthService);
  private listService = inject(ListService);
  private router = inject(Router);

  user = this.auth.user;
  lists = signal<UserList[]>([]);
  loading = signal(true);
  showCreate = false;
  showVoiceSettings = false;

  activeTab = signal<Tab>('lists');
  activeFilter = signal<Filter>('all');

  readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: '✦ All' },
    { key: 'todo', label: '✅ To-Do' },
    { key: 'shopping', label: '🛒 Shopping' },
    { key: 'other', label: '📝 Other' },
  ];

  filteredLists = computed(() => {
    const f = this.activeFilter();
    return f === 'all' ? this.lists() : this.lists().filter((l) => l.listType === f);
  });

  todoLists = computed(() => this.lists().filter((l) => l.listType === 'todo'));

  totalItems = computed(() => this.lists().reduce((s, l) => s + l.items.length, 0));
  doneItems = computed(() =>
    this.lists().reduce((s, l) => s + l.items.filter((i) => i.completed).length, 0),
  );

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning ☀️';
    if (h < 17) return 'Good afternoon 👋';
    return 'Good evening 🌙';
  }

  get firstName(): string {
    return this.user()?.name?.split(' ')[0] ?? '';
  }

  ngOnInit(): void {
    this.loadLists();
  }

  private loadLists(): void {
    const userId = this.user()?.id ?? '';
    this.listService.getLists(userId).subscribe({
      next: (data) => {
        this.lists.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openList(list: UserList): void {
    this.router.navigate(['/list', list._id]);
  }

  createList({ name, listType, completeByDate, repeatFrequency }: CreateListForm): void {
    const userId = this.user()?.id ?? '';
    this.listService
      .createList({ name, listType, ownerId: userId, completeByDate, repeatFrequency })
      .subscribe({
        next: (created) => {
          this.lists.update((l) => [created, ...l]);
          this.showCreate = false;
          this.router.navigate(['/list', created._id]);
        },
      });
  }

  onListUpdated(updated: UserList): void {
    this.lists.update((all) => all.map((l) => (l._id === updated._id ? updated : l)));
  }

  deleteList(event: MouseEvent, list: UserList): void {
    event.stopPropagation();
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return;
    this.listService.deleteList(list._id!).subscribe({
      next: () => this.lists.update((l) => l.filter((x) => x._id !== list._id)),
    });
  }

  goToApps(): void {
    window.location.href = location.hostname === 'localhost' ? 'http://localhost:4200' : '/';
  }

  // ── Card helpers ─────────────────────────────────────────────────────────

  typeGradient(t: string): string {
    return TYPE_GRADIENTS[t] ?? TYPE_GRADIENTS['other'];
  }
  typeColor(t: string): string {
    return TYPE_COLORS[t] ?? TYPE_COLORS['other'];
  }
  typeEmoji(t: string): string {
    return TYPE_EMOJI[t] ?? '📝';
  }

  doneCount(list: UserList): number {
    return list.items.filter((i) => i.completed).length;
  }

  progressPct(list: UserList): number {
    if (!list.items.length) return 0;
    return Math.round((this.doneCount(list) / list.items.length) * 100);
  }

  ringOffset(list: UserList): number {
    // SVG circle circumference ≈ 100 used as dasharray, offset = 100 - pct
    return 100 - this.progressPct(list);
  }

  repeatLabel(freq: string): string {
    return REPEAT_FREQUENCY_LABELS[freq as RepeatFrequency] ?? freq;
  }
}
