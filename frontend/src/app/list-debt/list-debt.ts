import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DebtService } from '../services/debt.service';
import { Debt } from '../models/debt.model';
import { CreateDebtAccountComponent } from '../create-debt-account/create-debt-account';

@Component({
  selector: 'app-list-debt',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './list-debt.html',
  styleUrls: ['./list-debt.scss']
})
export class ListDebtComponent implements OnInit {
  debts: Debt[] = [];

  constructor(
    private debtService: DebtService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadDebts();
  }

  loadDebts(): void {
    this.debtService.getDebts().subscribe({
      next: (data) => this.debts = data,
      error: (err) => console.error('Error fetching debts', err)
    });
  }

  openDebtDialog(debt?: Debt): void {
    const dialogRef = this.dialog.open(CreateDebtAccountComponent, {
      width: '600px',
      data: debt
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadDebts();
      }
    });
  }

  deleteDebt(id: string): void {
    if (confirm('Are you sure you want to delete this debt account?')) {
      this.debtService.deleteDebt(id).subscribe({
        next: () => this.loadDebts(),
        error: (err) => alert('Failed to delete debt')
      });
    }
  }
}
