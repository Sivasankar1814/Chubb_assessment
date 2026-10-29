import { Component, computed, input } from '@angular/core';
import { initials } from '../initials';

/** A person's initials in a circle. The name is always written out next to it, so this is decoration. Size it with `--avatar-size`. */
@Component({
  selector: 'app-avatar',
  template: `<span class="avatar" [class.brand]="tone() === 'brand'" aria-hidden="true">{{
    letters()
  }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    .avatar {
      display: inline-grid;
      place-items: center;
      width: var(--avatar-size, 36px);
      height: var(--avatar-size, 36px);
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: calc(var(--avatar-size, 36px) * 0.38);
      font-weight: 700;
      letter-spacing: 0.02em;
      user-select: none;

      &.brand {
        background: linear-gradient(145deg, var(--app-brand-400), var(--app-brand-600));
        color: var(--app-on-brand);
      }
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly tone = input<'soft' | 'brand'>('soft');
  protected readonly letters = computed(() => initials(this.name()));
}
