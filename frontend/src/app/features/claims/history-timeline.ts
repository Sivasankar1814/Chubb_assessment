import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ClaimHistoryEntry } from '../../models/claim';
import { HistoryAction } from '../../models/enums';
import { StatusChip } from '../../shared/components/status-chip';

interface ActionLook {
  title: string;
  icon: string;
}

const LOOKS: Record<HistoryAction, ActionLook> = {
  CREATED: { title: 'Claim submitted', icon: 'post_add' },
  ASSIGNED: { title: 'Assigned to an officer', icon: 'person_add' },
  REASSIGNED: { title: 'Reassigned to another officer', icon: 'swap_horiz' },
  STATUS_CHANGED: { title: 'Status changed', icon: 'sync_alt' },
  INFO_REQUESTED: { title: 'Information requested', icon: 'help_outline' },
  INFO_PROVIDED: { title: 'Information provided', icon: 'reply' },
};

/** The audit trail of a claim, newest first. */
@Component({
  selector: 'app-history-timeline',
  imports: [DatePipe, MatIconModule, StatusChip],
  template: `
    <ol class="timeline">
      @for (entry of ordered(); track entry.id) {
        <li>
          <mat-icon class="marker" aria-hidden="true">{{ look(entry).icon }}</mat-icon>
          <div class="body">
            <div class="head">
              <strong>{{ look(entry).title }}</strong>
              @if (entry.fromStatus && entry.fromStatus !== entry.toStatus) {
                <span class="move">
                  <app-status-chip [status]="entry.fromStatus" />
                  <mat-icon aria-label="to">arrow_forward</mat-icon>
                  <app-status-chip [status]="entry.toStatus" />
                </span>
              } @else {
                <app-status-chip [status]="entry.toStatus" />
              }
            </div>
            @if (entry.remarks) {
              <p class="remarks">{{ entry.remarks }}</p>
            }
            <p class="meta muted">
              {{ entry.changedBy }} ·
              <time [attr.datetime]="entry.changedAt">{{
                entry.changedAt | date: 'dd MMM yyyy, HH:mm'
              }}</time>
            </p>
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    li {
      position: relative;
      display: flex;
      gap: 14px;
      padding-bottom: 22px;

      &:last-child {
        padding-bottom: 0;
      }

      &:not(:last-child)::before {
        content: '';
        position: absolute;
        left: 17px;
        top: 40px;
        bottom: 4px;
        width: 2px;
        border-radius: 1px;
        background: var(--app-track);
      }

      // The newest entry is the one that matters; its marker is filled.
      &:first-child .marker {
        background: var(--app-brand-600);
        color: var(--app-on-brand);
      }
    }

    .marker {
      flex: none;
      box-sizing: content-box;
      width: 20px;
      height: 20px;
      padding: 7px;
      border-radius: 50%;
      font-size: 20px;
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }

    .body {
      min-width: 0;
      flex: 1;
    }

    .head,
    .move {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
    }

    .move mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--app-muted);
    }

    .remarks {
      margin: 6px 0 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .meta {
      margin: 4px 0 0;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class HistoryTimeline {
  readonly entries = input.required<readonly ClaimHistoryEntry[]>();
  protected readonly ordered = computed(() => [...this.entries()].reverse());

  protected look(entry: ClaimHistoryEntry): ActionLook {
    return LOOKS[entry.action] ?? { title: entry.action, icon: 'history' };
  }
}
