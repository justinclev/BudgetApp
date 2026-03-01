import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ListService } from '../services/list.service';
import { UserList } from '../models/list.model';
import { ListCardComponent } from './list-card/list-card.component';
import {
  CreateListModalComponent,
  CreateListForm,
} from './create-list-modal/create-list-modal.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ListCardComponent, CreateListModalComponent],
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

  createList({ name, listType }: CreateListForm): void {
    const userId = this.user()?.id ?? '';
    this.listService.createList({ name, listType, ownerId: userId }).subscribe({
      next: (created) => {
        this.lists.update((l) => [created, ...l]);
        this.showCreate = false;
        this.router.navigate(['/list', created._id]);
      },
    });
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
}
