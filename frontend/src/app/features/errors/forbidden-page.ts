import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { StateMessage } from '../../shared/components/state-message';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, MatButtonModule, StateMessage],
  template: `
    <div class="page">
      <app-state-message
        kind="error"
        title="You don't have access to this page"
        message="Your role doesn't include it. If you think that's a mistake, ask a manager."
      >
        <a matButton="filled" routerLink="/dashboard">Back to the dashboard</a>
      </app-state-message>
    </div>
  `,
})
export class ForbiddenPage {}
