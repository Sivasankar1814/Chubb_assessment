import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Claim } from '../../models/claim';
import { StatusChip } from '../../shared/components/status-chip';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { MarketName } from '../../shared/pipes/market-name-pipe';
import { MoneyPipe } from '../../shared/pipes/money-pipe';

/** A short list of claims for the dashboard: enough to recognise one and jump to it. */
@Component({
  selector: 'app-claim-mini-list',
  imports: [RouterLink, MoneyPipe, StatusChip, EnumLabel, MarketName],
  template: `
    @if (claims().length === 0) {
      <p class="empty muted">{{ emptyText() }}</p>
    } @else {
      <ul class="list">
        @for (claim of claims(); track claim.id) {
          <li>
            <div class="top">
              <a [routerLink]="['/claims', claim.id]">{{ claim.claimNumber }}</a>
              <app-status-chip [status]="claim.status" />
            </div>
            <p class="line muted">
              {{ claim.claimantName }} · {{ claim.claimType | enumLabel }} ·
              {{ claim.market | marketName }} ·
              <span class="amount">{{ claim.claimAmount | money: claim.market }}</span>
            </p>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .list {
      list-style: none;
      margin: 0 -10px;
      padding: 0;
    }

    li {
      position: relative;
      padding: 12px 10px;
      border-radius: var(--mat-sys-corner-medium);
      transition: background var(--app-fast) var(--app-ease);

      &:not(:last-child)::after {
        content: '';
        position: absolute;
        left: 10px;
        right: 10px;
        bottom: 0;
        height: 1px;
        background: var(--app-border);
      }

      &:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
      }
    }

    .top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 12px;

      a {
        font-weight: 650;
        text-decoration: none;

        // The whole row is the click target, not just the claim number.
        &::before {
          content: '';
          position: absolute;
          inset: 0;
        }

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .line {
      margin: 4px 0 0;
      font: var(--mat-sys-body-small);
    }

    .amount {
      font-variant-numeric: tabular-nums;
    }

    .empty {
      margin: 0;
      padding: 8px 0;
    }
  `,
})
export class ClaimMiniList {
  readonly claims = input.required<readonly Claim[]>();
  readonly emptyText = input('Nothing here.');
}
