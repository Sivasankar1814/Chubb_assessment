import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'claims.theme';
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

/** Follows the OS by default; the viewer can pin light or dark. The choice is a per-browser convenience only. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly choice = signal<ThemeChoice>(this.load());
  readonly current = this.choice.asReadonly();

  constructor() {
    this.apply(this.choice());
  }

  cycle(): void {
    const next = ORDER[(ORDER.indexOf(this.choice()) + 1) % ORDER.length];
    this.choice.set(next);
    this.apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // not remembered; the next visit starts from the OS setting
    }
  }

  private apply(choice: ThemeChoice): void {
    const root = this.document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', choice);
    }
  }

  private load(): ThemeChoice {
    try {
      const stored = localStorage.getItem(KEY);
      return ORDER.find((c) => c === stored) ?? 'system';
    } catch {
      return 'system';
    }
  }
}
