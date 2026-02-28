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

@Component({
  selector: 'app-list-detail',
  standalone: true,
  imports: [FormsModule, DragDropModule],
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

  isOwner = computed(() => {
    const uid = this.auth.user()?.email ?? '';
    return this.list()?.ownerId === uid;
  });

  sortedItems = computed(() => {
    const items = this.list()?.items ?? [];
    return [...items].sort((a, b) => Number(a.completed) - Number(b.completed));
  });

  pendingItems = signal<ListItem[]>([]);
  doneItems = computed(() => this.list()?.items.filter((i) => i.completed) ?? []);

  newItemText = '';
  private drafts: Record<string, string> = {};
  private subDrafts: Record<string, string> = {}; // key: `${parentId}:${subId}`
  expandedItems = signal<Set<string>>(new Set());
  newSubTexts = signal<Record<string, string | undefined>>({});
  private listId = '';

  @ViewChildren('itemInput') itemInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('newInput') newInputRef!: ElementRef<HTMLInputElement>;

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

  loadList(): void {
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

  startEditName(): void {
    this.editName = this.list()?.name ?? '';
    this.editingName.set(true);
  }

  saveName(): void {
    if (!this.editName.trim()) {
      this.editingName.set(false);
      return;
    }
    const current = this.list();
    this.listService
      .updateList(this.listId, {
        name: this.editName.trim(),
        listType: current?.listType ?? 'other',
      })
      .subscribe({
        next: (updated) => {
          this.list.set(updated);
          this.editingName.set(false);
        },
      });
  }

  // ── Inline item editing ───────────────────────────────────────────────────

  onDraftChange(itemId: string, event: Event): void {
    this.drafts[itemId] = (event.target as HTMLInputElement).value;
  }

  onItemBlur(item: ListItem): void {
    const draft = this.drafts[item.id];
    if (draft === undefined || draft === item.text) return;
    if (draft.trim() === '') {
      this.deleteItem(item);
    } else {
      this.listService.updateItemText(this.listId, item.id, draft.trim()).subscribe({
        next: (updated) => {
          this.list.set(updated);
          delete this.drafts[item.id];
        },
      });
    }
  }

  onItemKeydown(event: KeyboardEvent, item: ListItem, index: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const draft = this.drafts[item.id];
      if (draft !== undefined && draft !== item.text && draft.trim()) {
        this.listService.updateItemText(this.listId, item.id, draft.trim()).subscribe({
          next: (updated) => {
            this.list.set(updated);
            delete this.drafts[item.id];
            setTimeout(() => this.newInputRef?.nativeElement.focus(), 30);
          },
        });
      } else {
        setTimeout(() => this.newInputRef?.nativeElement.focus(), 30);
      }
    } else if (event.key === 'Backspace') {
      const draft = this.drafts[item.id] ?? item.text;
      if (draft === '') {
        event.preventDefault();
        this.deleteItem(item);
        setTimeout(() => {
          const inputs = this.itemInputs.toArray();
          if (index > 0 && inputs[index - 1]) {
            inputs[index - 1].nativeElement.focus();
          } else {
            this.newInputRef?.nativeElement.focus();
          }
        }, 50);
      }
    }
  }

  onNewItemKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addNewItem();
    } else if (event.key === 'Backspace' && this.newItemText === '') {
      setTimeout(() => {
        const inputs = this.itemInputs.toArray();
        if (inputs.length > 0) inputs[inputs.length - 1].nativeElement.focus();
      }, 0);
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

  // ── Sub-item expand / collapse ─────────────────────────────────────────────

  isExpanded(itemId: string): boolean {
    return this.expandedItems().has(itemId);
  }

  toggleExpand(itemId: string): void {
    this.expandedItems.update((s) => {
      const n = new Set(s);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
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

  // ── Sub-item CRUD ──────────────────────────────────────────────────────────

  setNewSubText(parentId: string, value: string): void {
    this.newSubTexts.update((t) => ({ ...t, [parentId]: value }));
  }

  addSubItem(parent: ListItem): void {
    const text = (this.newSubTexts()[parent.id] ?? '').trim();
    if (!text) return;
    this.listService.addSubItem(this.listId, parent.id, { text }).subscribe({
      next: (updated) => {
        this.list.set(updated);
        this.newSubTexts.update((t) => ({ ...t, [parent.id]: '' }));
        this.expandedItems.update((s) => new Set([...s, parent.id]));
      },
    });
  }

  onSubDraftChange(parentId: string, subId: string, event: Event): void {
    this.subDrafts[`${parentId}:${subId}`] = (event.target as HTMLInputElement).value;
  }

  onSubItemBlur(parent: ListItem, sub: SubItem): void {
    const key = `${parent.id}:${sub.id}`;
    const draft = this.subDrafts[key];
    if (draft === undefined || draft === sub.text) return;
    if (draft.trim() === '') {
      this.listService.deleteSubItem(this.listId, parent.id, sub.id).subscribe({
        next: (updated) => {
          this.list.set(updated);
          delete this.subDrafts[key];
        },
      });
    } else {
      this.listService.updateSubItemText(this.listId, parent.id, sub.id, draft.trim()).subscribe({
        next: (updated) => {
          this.list.set(updated);
          delete this.subDrafts[key];
        },
      });
    }
  }

  onSubItemKeydown(event: KeyboardEvent, parent: ListItem, sub: SubItem): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const key = `${parent.id}:${sub.id}`;
      const draft = this.subDrafts[key];
      if (draft !== undefined && draft !== sub.text && draft.trim()) {
        this.listService.updateSubItemText(this.listId, parent.id, sub.id, draft.trim()).subscribe({
          next: (updated) => {
            this.list.set(updated);
            delete this.subDrafts[key];
          },
        });
      }
    } else if (event.key === 'Backspace') {
      const key = `${parent.id}:${sub.id}`;
      const draft = this.subDrafts[key] ?? sub.text;
      if (draft === '') {
        event.preventDefault();
        this.listService.deleteSubItem(this.listId, parent.id, sub.id).subscribe({
          next: (updated) => {
            this.list.set(updated);
            delete this.subDrafts[key];
          },
        });
      }
    }
  }

  onNewSubItemKeydown(event: KeyboardEvent, parent: ListItem): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addSubItem(parent);
    }
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

  // ── Existing actions ──────────────────────────────────────────────────────

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
    const url = `${location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => this.showToast('Share link copied!'));
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
