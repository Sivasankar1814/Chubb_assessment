import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth-service';
import { Avatar } from '../../shared/components/avatar';
import { EnumLabel } from '../../shared/pipes/enum-label-pipe';
import { MarketName } from '../../shared/pipes/market-name-pipe';

@Component({
  selector: 'app-profile-page',
  imports: [DatePipe, Avatar, EnumLabel, MarketName],
  template: `
    <div class="page narrow">
      <header class="page-header">
        <div>
          <h1>Your profile</h1>
          <p class="subtitle">Ask a manager if any of these details need to change.</p>
        </div>
      </header>

      @if (user(); as u) {
        <section class="surface-card identity" aria-label="Who you are">
          <app-avatar [name]="u.fullName" tone="brand" />
          <div>
            <p class="name">{{ u.fullName }}</p>
            <p class="role">{{ u.role | enumLabel }}</p>
          </div>
        </section>

        <section class="surface-card" aria-labelledby="details-heading">
          <h2 id="details-heading" class="section-title">Details</h2>
          <dl class="facts">
            <div>
              <dt>Name</dt>
              <dd>{{ u.fullName }}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{{ u.role | enumLabel }}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{{ u.username }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{{ u.email }}</dd>
            </div>
            @if (u.phone) {
              <div>
                <dt>Phone</dt>
                <dd>{{ u.phone }}</dd>
              </div>
            }
            @if (u.market) {
              <div>
                <dt>Market</dt>
                <dd>{{ u.market | marketName }}</dd>
              </div>
            }
            @if (u.policyNumber) {
              <div>
                <dt>Policy number</dt>
                <dd>{{ u.policyNumber }}</dd>
              </div>
            }
            @if (u.specialization) {
              <div>
                <dt>Specialization</dt>
                <dd>{{ u.specialization }}</dd>
              </div>
            }
            @if (u.maxCapacity) {
              <div>
                <dt>Claim capacity</dt>
                <dd>{{ u.maxCapacity }} open claims</dd>
              </div>
            }
            <div>
              <dt>Member since</dt>
              <dd>{{ u.createdAt | date: 'dd MMM yyyy' }}</dd>
            </div>
          </dl>
        </section>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 800px;
    }

    .identity {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px 28px;
      background: linear-gradient(
        120deg,
        color-mix(in srgb, var(--app-brand-600) 11%, var(--app-card)),
        var(--app-card) 65%
      );
      --avatar-size: 72px;

      p {
        margin: 0;
      }
    }

    .name {
      font: var(--mat-sys-title-large);
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .role {
      margin-top: 2px;
      color: var(--app-muted);
      font: var(--mat-sys-label-large);
    }
  `,
})
export class ProfilePage {
  protected readonly user = inject(AuthService).user;
}
