import { Component, Input, Output, EventEmitter } from '@angular/core';
import { UserList } from '../../models/list.model';

@Component({
  selector: 'app-members-panel',
  standalone: true,
  templateUrl: './members-panel.component.html',
  styleUrl: './members-panel.component.scss',
})
export class MembersPanelComponent {
  @Input({ required: true }) list!: UserList;
  @Input() isOwner = false;
  @Output() close = new EventEmitter<void>();
  @Output() removeMember = new EventEmitter<string>();
}
