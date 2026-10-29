import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WorkloadLevel } from '../../models/enums';
import { OfficerWorkload } from '../../models/workload';

interface LevelLook {
  label: string;
  icon: string;
  color: string;
}

// Load is a state, so it wears the status colours and always carries an icon and a word.
const LEVELS: Record<WorkloadLevel, LevelLook> = {
  LOW: { label: 'Low load', icon: 'check_circle', color: 'var(--app-info)' },
  MODERATE: { label: 'Moderate load', icon: 'adjust', color: 'var(--app-info)' },
  HIGH: { label: 'High load', icon: 'warning', color: 'var(--app-warning)' },
  FULL: { label: 'At capacity', icon: 'block', color: 'var(--app-critical)' },
};

/** One officer's open claims against their capacity: a track, a fill, and the figures in words. */
@Component({
  selector: 'app-workload-meter',
  imports: [MatIconModule],
  template: `
    <div class="meter" [style.--fill-color]="look().color">
      <div class="figures">
        <span>
          <strong>{{ workload().openClaims }}</strong> of {{ workload().maxCapacity }} open
        </span>
        <span class="level">
          <mat-icon aria-hidden="true">{{ look().icon }}</mat-icon>
          {{ look().label }}
        </span>
      </div>
      <div
        class="track"
        role="meter"
        aria-label="Capacity used"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent()"
        [attr.aria-valuetext]="
          workload().openClaims + ' of ' + workload().maxCapacity + ' claims open, ' + look().label
        "
      >
        <div class="fill" [style.width.%]="percent()"></div>
      </div>
    </div>
  `,
  styles: `
    .figures {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .level {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: var(--mat-sys-label-large);
    }

    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--fill-color);
    }

    .track {
      height: 10px;
      border-radius: 5px;
      background: var(--app-track);
      overflow: hidden;
    }

    // The bar grows from empty when it appears, which also reads as "loaded" rather than "was always there".
    .fill {
      height: 100%;
      min-width: 3px;
      border-radius: 5px;
      background: var(--fill-color);
      transition: width var(--app-base) var(--app-ease);
      animation: grow 700ms var(--app-ease) backwards;
    }

    @keyframes grow {
      from {
        width: 0;
      }
    }

    @media (forced-colors: active) {
      .track {
        border: 1px solid CanvasText;
      }
      .fill {
        background: Highlight;
      }
    }
  `,
})
export class WorkloadMeter {
  readonly workload = input.required<OfficerWorkload>();
  protected readonly look = computed(() => LEVELS[this.workload().level]);
  protected readonly percent = computed(() =>
    Math.max(0, Math.min(100, Math.round(this.workload().utilizationPercent))),
  );
}
