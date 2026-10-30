import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BrandMark } from './brand-mark';

/**
 * The page around the forms a visitor reaches from the sign-in screen (create a user, reset a password): the brand,
 * one card for the projected form, and a way back. Theme tokens only, so it follows light and dark like the app. Unlike
 * the sign-in screen it is allowed to scroll: its forms are taller than one window.
 */
@Component({
  selector: 'app-auth-frame',
  imports: [RouterLink, MatIconModule, BrandMark],
  host: { '[class.wide]': "width() === 'wide'" },
  template: `
    <main class="frame">
      <a class="brand" routerLink="/login" aria-label="Claims Management, back to sign in">
        <app-brand-mark />
        <span class="wordmark">Claims Management</span>
      </a>

      <div class="surface-card card">
        <header class="heading">
          <h1>{{ heading() }}</h1>
          @if (lead(); as text) {
            <p class="muted">{{ text }}</p>
          }
        </header>
        <ng-content />
      </div>

      <a class="back-link" routerLink="/login">
        <mat-icon aria-hidden="true">arrow_back</mat-icon>Back to sign in
      </a>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: var(--app-canvas);
      --frame-width: 460px;
    }

    :host(.wide) {
      --frame-width: 680px;
    }

    .frame {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 20px;
      width: 100%;
      max-width: calc(var(--frame-width) + 48px);
      margin: 0 auto;
      padding: clamp(20px, 5vh, 56px) 24px 48px;

      @media (max-width: 640px) {
        padding: 20px 16px 40px;
      }
    }

    .brand {
      --brand-mark-size: 36px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      align-self: flex-start;
      color: inherit;
      text-decoration: none;
    }

    .wordmark {
      font: var(--mat-sys-title-medium);
      font-weight: 650;
      letter-spacing: -0.01em;
    }

    .card {
      padding: 28px;
      animation: app-rise 420ms var(--app-ease) backwards;

      @media (max-width: 640px) {
        padding: 20px 16px;
      }
    }

    .heading {
      margin-bottom: 20px;

      h1 {
        font-size: clamp(1.5rem, 1.25rem + 1vw, 1.875rem);
        font-weight: 750;
        line-height: 1.15;
        letter-spacing: -0.025em;
      }

      p {
        margin: 8px 0 0;
        font: var(--mat-sys-body-large);
      }
    }
  `,
})
export class AuthFrame {
  readonly heading = input.required<string>();
  readonly lead = input<string>();
  readonly width = input<'narrow' | 'wide'>('narrow');
}
