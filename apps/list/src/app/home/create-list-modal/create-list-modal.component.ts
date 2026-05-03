import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ListType, RepeatFrequency, REPEAT_FREQUENCY_LABELS } from '../../models/list.model';

export interface CreateListForm {
  name: string;
  listType: ListType;
  completeByDate?: string;
  repeatFrequency?: RepeatFrequency;
}

@Component({
  selector: 'app-create-list-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './create-list-modal.component.html',
  styleUrl: './create-list-modal.component.scss',
})
export class CreateListModalComponent {
  @Output() create = new EventEmitter<CreateListForm>();
  @Output() cancel = new EventEmitter<void>();

  name = '';
  listType: ListType = 'shopping';
  completeByDate = '';
  repeatFrequency: RepeatFrequency | '' = '';

  readonly repeatOptions = Object.entries(REPEAT_FREQUENCY_LABELS) as [RepeatFrequency, string][];

  onDateChange(value: string): void {
    this.completeByDate = value;
    if (!value) this.repeatFrequency = '';
  }

  submit(): void {
    if (!this.name.trim()) return;
    const form: CreateListForm = { name: this.name.trim(), listType: this.listType };
    if (this.listType === 'todo') {
      if (this.completeByDate) form.completeByDate = new Date(this.completeByDate).toISOString();
      if (this.repeatFrequency) form.repeatFrequency = this.repeatFrequency as RepeatFrequency;
    }
    this.create.emit(form);
    this.name = '';
    this.listType = 'shopping';
    this.completeByDate = '';
    this.repeatFrequency = '';
  }
}
