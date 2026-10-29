import { Component } from '@angular/core';

/** The product mark: a shield with a tick on a brand-coloured tile. Size it with `--brand-mark-size`. */
@Component({
  selector: 'app-brand-mark',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3 4.5 6v5.2c0 4.5 3.1 8.2 7.5 9.8 4.4-1.6 7.5-5.3 7.5-9.8V6L12 3Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
      <path
        d="m8.8 12.2 2.3 2.3 4.3-4.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: var(--brand-mark-size, 40px);
      height: var(--brand-mark-size, 40px);
      border-radius: 30%;
      background: linear-gradient(145deg, var(--app-brand-400), var(--app-brand-600));
      box-shadow:
        inset 0 0 0 1px var(--app-glass-border),
        0 6px 16px -4px var(--app-brand-glow);
      color: var(--app-on-brand);
    }

    svg {
      width: 58%;
      height: 58%;
    }
  `,
})
export class BrandMark {}
