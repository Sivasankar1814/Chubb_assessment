import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { StateMessage } from '../../shared/components/state-message';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule, StateMessage],
  template: `
    <div class="page">
      <app-state-message
        title="That page doesn't exist"
        message="The address may be mistyped, or the page may have moved."
      >
        <a matButton="filled" routerLink="/dashboard">Back to the dashboard</a>
      </app-state-message>
    </div>
  `,
})
export class NotFoundPage {}
