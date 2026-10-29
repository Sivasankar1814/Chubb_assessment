import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** The empty and error states every list and detail page needs. */
@Component({
  selector: 'app-state-message',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div
      class="state"
      [class.error]="kind() === 'error'"
      [attr.role]="kind() === 'error' ? 'alert' : 'status'"
    >
      <span class="badge">
        <mat-icon aria-hidden="true">{{ kind() === 'error' ? 'error_outline' : 'inbox' }}</mat-icon>
      </span>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p class="muted">{{ message() }}</p>
      }
      @if (retryable()) {
        <button matButton="outlined" type="button" (click)="retry.emit()">
          <mat-icon>refresh</mat-icon>Try again
        </button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 48px 20px;
      text-align: center;
    }

    .badge {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      margin-bottom: 6px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--mat-sys-primary) 11%, transparent);
      color: var(--mat-sys-primary);
    }

    .error .badge {
      background: color-mix(in srgb, var(--app-critical) 12%, transparent);
      color: var(--app-critical);
    }

    mat-icon {
      width: 34px;
      height: 34px;
      font-size: 34px;
    }

    button mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    h3 {
      font: var(--mat-sys-title-large);
      font-weight: 650;
      letter-spacing: -0.01em;
    }

    p {
      margin: 0;
      max-width: 52ch;
    }
  `,
})
export class StateMessage {
  readonly kind = input<'empty' | 'error'>('empty');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly retryable = input(false);
  readonly retry = output<void>();
}
