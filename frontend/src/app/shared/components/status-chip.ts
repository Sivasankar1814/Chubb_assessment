import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ClaimStatus } from '../../models/enums';
import { EnumLabel } from '../pipes/enum-label-pipe';

export interface StatusLook {
  icon: string;
  color: string;
}

// Colour groups the stage, the icon tells statuses in a group apart, and the label always spells it out.
const LOOKS: Record<ClaimStatus, StatusLook> = {
  OPEN: { icon: 'inbox', color: 'var(--app-info)' },
  ASSIGNED: { icon: 'person', color: 'var(--app-info)' },
  UNDER_REVIEW: { icon: 'rate_review', color: 'var(--app-info)' },
  ON_HOLD: { icon: 'pause_circle', color: 'var(--app-warning)' },
  APPROVED: { icon: 'check_circle', color: 'var(--app-good)' },
  REJECTED: { icon: 'cancel', color: 'var(--app-critical)' },
  SETTLED: { icon: 'paid', color: 'var(--app-good)' },
  CLOSED: { icon: 'lock', color: 'var(--app-neutral)' },
};

export function statusLook(status: ClaimStatus): StatusLook {
  return LOOKS[status];
}

@Component({
  selector: 'app-status-chip',
  imports: [MatIconModule, EnumLabel],
  template: `
    <span class="chip" [style.--chip-color]="look().color">
      <mat-icon aria-hidden="true">{{ look().icon }}</mat-icon>
      <span>{{ status() | enumLabel }}</span>
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 11px 3px 7px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--chip-color) 40%, transparent);
      background: color-mix(in srgb, var(--chip-color) 13%, transparent);
      color: var(--mat-sys-on-surface);
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.25;
      white-space: nowrap;
    }

    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: var(--chip-color);
    }

    @media (forced-colors: active) {
      .chip {
        border-color: CanvasText;
      }
    }
  `,
})
export class StatusChip {
  readonly status = input.required<ClaimStatus>();
  protected readonly look = computed(() => statusLook(this.status()));
}
