import {
  Directive,
  EmbeddedViewRef,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth-service';
import { Role } from '../../models/enums';

/**
 * Shows its content only to the listed roles. This hides controls the server would refuse anyway;
 * it is never the access check itself.
 */
@Directive({ selector: '[appHasRole]' })
export class HasRole {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private view: EmbeddedViewRef<unknown> | undefined;

  readonly appHasRole = input.required<readonly Role[]>();

  constructor() {
    effect(() => {
      const allowed = this.auth.hasRole(...this.appHasRole());
      if (allowed && !this.view) {
        this.view = this.container.createEmbeddedView(this.template);
      } else if (!allowed && this.view) {
        this.container.clear();
        this.view = undefined;
      }
    });
  }
}
