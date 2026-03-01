import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  ViewChildren,
  ViewChild,
  ElementRef,
  QueryList,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AuthService } from '../services/auth.service';
import { ListService } from '../services/list.service';
import { UserList, ListItem, SubItem } from '../models/list.model';
import { ListItemComponent, SubSaveEvent } from './list-item/list-item.component';
import { MembersPanelComponent } from './members-panel/members-panel.component';

@Component({
  selector: 'app-list-detail',
  standalone: true,
  imports: [FormsModule, DragDropModule, ListItemComponent, MembersPanelComponent],
  templateUrl: './list-detail.component.html',
  styleUrl: './list-detail.component.scss',
})
export class ListDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private listService = inject(ListService);
  private auth = inject(AuthService);

  list = signal<UserList | null>(null);
  loading = signal(true);
  editingName = signal(false);
  editName = '';
  showMenu = false;
  showMembers = false;
  toast = signal('');

  isOwner = computed(() => this.list()?.ownerId === (this.auth.user()?.email ?? ''));

  pendingItems = signal<ListItem[]>([]);
  doneItems = computed(() => this.list()?.items.filter((i) => i.completed) ?? []);

  newItemText = '';
  expandedItems = signal<Set<string>>(new Set());
  newSubTexts = signal<Record<string, string | undefined>>({});

  private listId = '';

  @ViewChildren(ListItemComponent) private listItemRefs!: QueryList<ListItemComponent>;
  @ViewChild('newInput') private newInputRef!: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      const items = this.list()?.items ?? [];
      this.pendingItems.set(items.filter((i) => !i.completed));
    });
  }

  ngOnInit(): void {
    this.listId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadList();
  }

  private loadList(): void {
    this.listService.getList(this.listId).subscribe({
      next: (data) => {
        this.list.set(data);
        this.loading.set(false);
        setTimeout(() => this.newInputRef?.nativeElement.focus(), 100);
      },
      error: () => this.loading.set(false),
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  // ── Header / name ────────────────────────────────────────────────────────

  startEditName(): void {
    this.editName = this.list()?.name ?? '';
    this.editingName.set(true);
  }

  saveName(): void {
    if (!this.editName.trim()) {
      this.editingName.set(false);
      return;
    }
    this.listService
      .updateList(this.listId, {
        name: this.editName.trim(),
        listType: this.list()?.listType ?? 'other',
      })
      .subscribe({
        next: (updated) => {
          this.list.set(updated);
          this.editingName.set(false);
        },
      });
  }

  // ── Item interactions ────────────────────────────────────────────────────

  toggleItem(item: ListItem): void {
    this.listService.toggleItem(this.listId, item.id).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  deleteItem(item: ListItem): void {
    this.listService.deleteItem(this.listId, item.id).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  saveItemText(item: ListItem, text: string): void {
    this.listService.updateItemText(this.listId, item.id, text).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  focusNewInput(): void {
    setTimeout(() => this.newInputRef?.nativeElement.focus(), 30);
  }

  deleteItemAndFocusPrev(item: ListItem, index: number): void {
    this.deleteItem(item);
    setTimeout(() => {
      const items = this.listItemRefs.toArray();
      if (index > 0 && items[index - 1]) {
        items[index - 1].focus();
      } else {
        this.newInputRef?.nativeElement.focus();
      }
    }, 50);
  }

  onNewItemKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addNewItem();
    } else if (event.key === 'Backspace' && this.newItemText === '') {
      const items = this.listItemRefs.toArray();
      if (items.length > 0) setTimeout(() => items[items.length - 1].focus(), 0);
    }
  }

  addNewItem(): void {
    if (!this.newItemText.trim()) return;
    this.listService.addItem(this.listId, { text: this.newItemText.trim() }).subscribe({
      next: (updated) => {
        this.list.set(updated);
        this.newItemText = '';
        setTimeout(() => this.newInputRef?.nativeElement.focus(), 30);
      },
    });
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────

  onDrop(event: CdkDragDrop<ListItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.pendingItems()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.pendingItems.set(items);
    const allIds = [...items, ...this.doneItems()].map((i) => i.id);
    this.listService.reorderItems(this.listId, allIds).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  onDragStart(item: ListItem): void {
    if (this.isExpanded(item.id)) {
      this.expandedItems.update((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  }

  // ── Sub-items ────────────────────────────────────────────────────────────

  isExpanded(itemId: string): boolean {
    return this.expandedItems().has(itemId);
  }

  toggleExpand(itemId: string): void {
    this.expandedItems.update((s) => {
      const n = new Set(s);
      n.has(itemId) ? n.delete(itemId) : n.add(itemId);
      return n;
    });
  }

  setNewSubText(parentId: string, value: string): void {
    this.newSubTexts.update((t) => ({ ...t, [parentId]: value }));
  }

  addSubItem(parent: ListItem, text: string): void {
    if (!text.trim()) return;
    this.listService.addSubItem(this.listId, parent.id, { text: text.trim() }).subscribe({
      next: (updated) => {
        this.list.set(updated);
        this.newSubTexts.update((t) => ({ ...t, [parent.id]: '' }));
        this.expandedItems.update((s) => new Set([...s, parent.id]));
      },
    });
  }

  toggleSubItem(parent: ListItem, sub: SubItem): void {
    this.listService.toggleSubItem(this.listId, parent.id, sub.id).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  deleteSubItem(parent: ListItem, sub: SubItem): void {
    this.listService.deleteSubItem(this.listId, parent.id, sub.id).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  saveSubItemText(parent: ListItem, { sub, text }: SubSaveEvent): void {
    this.listService.updateSubItemText(this.listId, parent.id, sub.id, text).subscribe({
      next: (updated) => this.list.set(updated),
    });
  }

  // ── List actions ─────────────────────────────────────────────────────────

  resetList(): void {
    this.showMenu = false;
    this.listService.resetList(this.listId).subscribe({
      next: (updated) => {
        this.list.set(updated);
        this.showToast('All items reset');
      },
    });
  }

  cloneList(): void {
    this.showMenu = false;
    const userId = this.auth.user()?.email ?? '';
    this.listService.cloneList(this.listId, userId).subscribe({
      next: (clone) => {
        this.showToast('List cloned!');
        setTimeout(() => this.router.navigate(['/list', clone._id]), 600);
      },
    });
  }

  deleteList(): void {
    if (!confirm('Delete this list? This cannot be undone.')) return;
    this.showMenu = false;
    this.listService.deleteList(this.listId).subscribe({
      next: () => this.router.navigate(['/']),
    });
  }

  copyShareLink(): void {
    this.showMenu = false;
    const token = this.list()?.shareToken;
    if (!token) return;
    navigator.clipboard
      .writeText(`${location.origin}/share/${token}`)
      .then(() => this.showToast('Share link copied!'));
  }

  removeMember(userId: string): void {
    this.listService.removeMember(this.listId, userId).subscribe({
      next: (updated) => {
        this.list.set(updated);
        this.showToast('Member removed');
      },
    });
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 2600);
  }
}
