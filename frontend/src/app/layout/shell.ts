import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../core/auth/auth-service';
import { ThemeChoice, ThemeService } from '../core/theme/theme-service';
import { Role } from '../models/enums';
import { Avatar } from '../shared/components/avatar';
import { BrandMark } from '../shared/components/brand-mark';
import { EnumLabel } from '../shared/pipes/enum-label-pipe';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Omitted means everyone. */
  roles?: readonly Role[];
  /** Highlight only on this exact URL: "Claims" must not stay lit on "New claim", nor "Users" on "New user". */
  exact?: boolean;
}

const STAFF: readonly Role[] = ['OFFICER', 'MANAGER'];

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
  { label: 'Claims', icon: 'description', path: '/claims', exact: true },
  { label: 'New claim', icon: 'add_circle_outline', path: '/claims/new' },
  { label: 'Workload', icon: 'groups', path: '/workload', roles: STAFF },
  { label: 'Users', icon: 'manage_accounts', path: '/users', roles: STAFF, exact: true },
  { label: 'New user', icon: 'person_add', path: '/users/new', roles: STAFF },
  { label: 'Profile', icon: 'account_circle', path: '/profile' },
];

const THEME_ICONS: Record<ThemeChoice, string> = {
  system: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    Avatar,
    BrandMark,
    EnumLabel,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');

  protected readonly user = this.auth.user;
  protected readonly role = this.auth.role;
  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );
  protected readonly themeIcon = computed(() => THEME_ICONS[this.theme.current()]);

  protected signOut(): void {
    this.auth.logout();
  }

  /** A plain `#main-content` link would go through the router's base href and reload the page. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main()?.nativeElement.focus();
  }
}
