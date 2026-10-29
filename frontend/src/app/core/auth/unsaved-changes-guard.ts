import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../shared/components/confirm-service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
  /** What would be lost, for the prompt: "claim" (the default) gives "Discard this claim?". */
  readonly discardSubject?: string;
}

/** Asks before a half-filled form is thrown away. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return inject(ConfirmService).confirm({
    title: `Discard this ${component.discardSubject ?? 'claim'}?`,
    message: 'You have not submitted it yet. If you leave now, what you entered is lost.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
  });
};
