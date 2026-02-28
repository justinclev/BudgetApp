import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Configuration data for the confirmation dialog */
export interface ConfirmationData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

/** Reusable confirmation dialog component - modern Angular standards */
@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: ConfirmationData,
  ) {
    this.validateData();
  }

  /** Validate that required dialog data is provided */
  private validateData(): void {
    if (!this.data?.title || !this.data?.message) {
      console.warn('ConfirmationDialog: title and message are required', this.data);
    }
  }

  /** Handle confirm action */
  onConfirm(): void {
    this.dialogRef.close(true);
  }

  /** Handle cancel action */
  onCancel(): void {
    this.dialogRef.close(false);
  }

  /** Get confirm button text with fallback */
  getConfirmText(): string {
    return this.data.confirmText?.trim() || 'Yes';
  }

  /** Get cancel button text with fallback */
  getCancelText(): string {
    return this.data.cancelText?.trim() || 'No';
  }
}
