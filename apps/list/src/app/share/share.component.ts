import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ListService } from '../services/list.service';
import { UserList } from '../models/list.model';

@Component({
  selector: 'app-share',
  standalone: true,
  templateUrl: './share.component.html',
  styleUrl: './share.component.scss',
})
export class ShareComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private listService = inject(ListService);
  private auth = inject(AuthService);

  status = signal<'loading' | 'joining' | 'success' | 'error'>('loading');
  listName = signal('');
  private listId = '';
  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.listService.getListByShareToken(this.token).subscribe({
      next: (list: UserList) => {
        this.listId = list._id ?? '';
        this.listName.set(list.name);
        // Check if already authorized
        const userId = this.auth.user()?.email ?? '';
        if (list.ownerId === userId || list.authorizedUsers.includes(userId)) {
          this.status.set('success');
        } else {
          this.status.set('joining');
        }
      },
      error: () => this.status.set('error'),
    });
  }

  join(): void {
    const userId = this.auth.user()?.email ?? '';
    this.listService.joinListByShareToken(this.token, { userId }).subscribe({
      next: (list: UserList) => {
        this.listId = list._id ?? '';
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  openList(): void {
    this.router.navigate(['/list', this.listId]);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
