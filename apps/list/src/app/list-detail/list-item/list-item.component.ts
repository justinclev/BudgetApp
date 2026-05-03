import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ListItem, SubItem } from '../../models/list.model';

export interface SubSaveEvent {
  sub: SubItem;
  text: string;
}

@Component({
  selector: 'app-list-item',
  standalone: true,
  imports: [DragDropModule],
  templateUrl: './list-item.component.html',
  styleUrl: './list-item.component.scss',
})
export class ListItemComponent {
  @Input({ required: true }) item!: ListItem;
  @Input() isExpanded = false;
  @Input() newSubText = '';

  @Output() toggle = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() saveText = new EventEmitter<string>();
  @Output() enterPressed = new EventEmitter<void>();
  @Output() deleteOnEmpty = new EventEmitter<void>();
  @Output() expandToggle = new EventEmitter<void>();
  @Output() subToggle = new EventEmitter<SubItem>();
  @Output() subDelete = new EventEmitter<SubItem>();
  @Output() subSaveText = new EventEmitter<SubSaveEvent>();
  @Output() subDeleteOnEmpty = new EventEmitter<SubItem>();
  @Output() newSubTextChange = new EventEmitter<string>();
  @Output() addSubItem = new EventEmitter<string>();

  @ViewChild('textInput') private textInputRef!: ElementRef<HTMLInputElement>;

  private draft = '';
  private subDrafts: Record<string, string> = {};

  focus(): void {
    this.textInputRef?.nativeElement.focus();
  }

  // ── Item text editing ────────────────────────────────────────────────────

  onDraftChange(event: Event): void {
    this.draft = (event.target as HTMLInputElement).value;
  }

  onBlur(): void {
    if (this.draft === '' || this.draft === this.item.text) {
      this.draft = '';
      return;
    }
    if (!this.draft.trim()) {
      this.delete.emit();
    } else {
      this.saveText.emit(this.draft.trim());
    }
    this.draft = '';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.draft && this.draft !== this.item.text && this.draft.trim()) {
        this.saveText.emit(this.draft.trim());
        this.draft = '';
      }
      this.enterPressed.emit();
    } else if (event.key === 'Backspace') {
      const current = this.draft !== '' ? this.draft : this.item.text;
      if (current === '') {
        event.preventDefault();
        this.deleteOnEmpty.emit();
      }
    }
  }

  // ── Sub-item text editing ────────────────────────────────────────────────

  onSubDraftChange(subId: string, event: Event): void {
    this.subDrafts[subId] = (event.target as HTMLInputElement).value;
  }

  onSubBlur(sub: SubItem): void {
    const draft = this.subDrafts[sub.id];
    if (draft === undefined || draft === sub.text) return;
    if (!draft.trim()) {
      this.subDelete.emit(sub);
    } else {
      this.subSaveText.emit({ sub, text: draft.trim() });
    }
    delete this.subDrafts[sub.id];
  }

  onSubKeydown(event: KeyboardEvent, sub: SubItem): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const draft = this.subDrafts[sub.id];
      if (draft !== undefined && draft !== sub.text && draft.trim()) {
        this.subSaveText.emit({ sub, text: draft.trim() });
        delete this.subDrafts[sub.id];
      }
    } else if (event.key === 'Backspace') {
      const current = this.subDrafts[sub.id] ?? sub.text;
      if (current === '') {
        event.preventDefault();
        this.subDeleteOnEmpty.emit(sub);
      }
    }
  }

  onNewSubKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addSubItem.emit(this.newSubText);
    }
  }
}
