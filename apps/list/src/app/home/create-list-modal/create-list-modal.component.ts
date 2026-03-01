import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ListType } from '../../models/list.model';

export interface CreateListForm {
  name: string;
  listType: ListType;
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

  submit(): void {
    if (!this.name.trim()) return;
    this.create.emit({ name: this.name.trim(), listType: this.listType });
    this.name = '';
    this.listType = 'shopping';
  }
}
