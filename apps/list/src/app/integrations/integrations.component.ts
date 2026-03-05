import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { IntegrationsService, GenerateKeyResponse } from '../services/integrations.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './integrations.component.html',
  styleUrl: './integrations.component.scss',
})
export class IntegrationsComponent {
  private auth = inject(AuthService);
  private integrationsService = inject(IntegrationsService);

  /** The current user's generated webhook API key, if any. */
  apiKey = signal<string | null>(null);

  /** Loading state while the generate request is in-flight. */
  generating = signal(false);

  /** Error message to display if generation fails. */
  errorMessage = signal<string | null>(null);

  /** True for 2 s after the key is copied to clipboard. */
  copied = signal(false);

  /** The IFTTT-ready webhook URL for this environment. */
  readonly webhookUrl = `${environment.apiUrl}/integrations/ifttt-webhook`;

  /** Generate (or regenerate) a personal webhook API key. */
  generateKey(): void {
    const user = this.auth.getUser();
    if (!user) return;

    this.generating.set(true);
    this.errorMessage.set(null);

    this.integrationsService.generateWebhookKey(user.id).subscribe({
      next: (res: GenerateKeyResponse) => {
        this.apiKey.set(res.api_key);
        this.generating.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? 'Failed to generate key. Please try again.');
        this.generating.set(false);
      },
    });
  }

  /** Copy the API key to the clipboard and briefly show a "Copied!" confirmation. */
  copyKey(): void {
    const key = this.apiKey();
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  /** Copy the webhook URL to the clipboard. */
  copyUrl(): void {
    navigator.clipboard.writeText(this.webhookUrl);
  }
}
