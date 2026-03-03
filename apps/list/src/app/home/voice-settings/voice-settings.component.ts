import { Component, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { ListService } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

type Platform = 'siri' | 'alexa' | 'google';

@Component({
  selector: 'app-voice-settings',
  standalone: true,
  imports: [],
  templateUrl: './voice-settings.component.html',
  styleUrl: './voice-settings.component.scss',
})
export class VoiceSettingsComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private auth = inject(AuthService);
  private listService = inject(ListService);

  token = signal<string | null>(null);
  loading = signal(true);
  copied = signal(false);
  expanded = signal<Platform | null>(null);

  readonly commandUrl = (environment.production
    ? environment.apiUrl
    : 'https://budgetapp-ma3x.onrender.com/api') + '/voice/command';

  ngOnInit(): void {
    const userId = this.auth.user()?.id ?? '';
    if (!userId) { this.loading.set(false); return; }
    this.listService.getVoiceToken(userId).subscribe({
      next: (res) => { this.token.set(res.token); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  copyToken(): void {
    const t = this.token();
    if (!t) return;
    navigator.clipboard.writeText(t).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  toggle(platform: Platform): void {
    this.expanded.update((cur) => (cur === platform ? null : platform));
  }

  isOpen(platform: Platform): boolean {
    return this.expanded() === platform;
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('vs-overlay')) {
      this.close.emit();
    }
  }
}
