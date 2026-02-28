import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ListService } from '../services/list.service';
import { UserList, ListType } from '../models/list.model';

const TYPE_LABELS: Record<string, string> = {
  shopping: '🛒 Shopping',
  todo: '✅ To-Do',
  other: '📝 Other',
};

const TYPE_COLORS: Record<string, string> = {
  shopping: '#f59e0b',
  todo: '#10b981',
  other: '#8b5cf6',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
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
  newName = '';
  newType: ListType = 'shopping';

  ngOnInit(): void {
    this.loadLists();
  }

  loadLists(): void {
    const userId = this.user()?.email ?? '';
    this.listService.getLists(userId).subscribe({
      next: (data) => { this.lists.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openList(list: UserList): void {
    this.router.navigate(['/list', list._id]);
  }

  createList(): void {
    if (!this.newName.trim()) return;
    const userId = this.user()?.email ?? '';
    this.listService.createList({ name: this.newName.trim(), listType: this.newType, ownerId: userId }).subscribe({
      next: (created) => {
        this.lists.update(l => [created, ...l]);
        this.showCreate = false;
        this.newName = '';
        this.newType = 'shopping';
        this.router.navigate(['/list', created._id]);
      },
    });
  }

  deleteList(event: Event, list: UserList): void {
    event.stopPropagation();
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return;
    this.listService.deleteList(list._id!).subscribe({
      next: () => this.lists.update(l => l.filter(x => x._id !== list._id)),
    });
  }

  typeLabel(t: string): string { return TYPE_LABELS[t] ?? '📝 Other'; }
  typeColor(t: string): string { return TYPE_COLORS[t] ?? '#8b5cf6'; }

  doneCount(list: UserList): number {
    return list.items.filter(i => i.completed).length;
  }

  progressPct(list: UserList): number {
    if (!list.items.length) return 0;
    return Math.round((this.doneCount(list) / list.items.length) * 100);
  }

  goToApps(): void {
    window.location.href = location.hostname === 'localhost' ? 'http://localhost:4200' : '/';
  }
}
