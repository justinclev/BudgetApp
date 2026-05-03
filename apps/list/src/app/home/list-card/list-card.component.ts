import { Component, Input, Output, EventEmitter } from '@angular/core';
import { UserList } from '../../models/list.model';

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
  selector: 'app-list-card',
  standalone: true,
  templateUrl: './list-card.component.html',
  styleUrl: './list-card.component.scss',
})
export class ListCardComponent {
  @Input({ required: true }) list!: UserList;
  @Output() open = new EventEmitter<void>();
  @Output() delete = new EventEmitter<MouseEvent>();

  get typeLabel(): string {
    return TYPE_LABELS[this.list.listType] ?? '📝 Other';
  }
  get typeColor(): string {
    return TYPE_COLORS[this.list.listType] ?? '#8b5cf6';
  }

  get doneCount(): number {
    return this.list.items.filter((i) => i.completed).length;
  }

  get progressPct(): number {
    if (!this.list.items.length) return 0;
    return Math.round((this.doneCount / this.list.items.length) * 100);
  }
}
