import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** The backend's pattern for a phone number (CreateUserRequest and RegisterRequest). */
export const PHONE_PATTERN = /^\+?[0-9\- ]{7,20}$/;

/**
 * "Confirm password": the value must equal the sibling control's. An empty value passes, because `required` already
 * says so, and so does a control that is not in a group yet (there is nothing to compare with). The sibling's own
 * changes must re-run this (`updateValueAndValidity()` on the confirm control), as a validator only runs when its own
 * control changes. This is a check on the screen only; the server never sees it.
 */
export function sameAs(siblingName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (value === null || value === undefined || value === '' || !control.parent) {
      return null;
    }
    const sibling = control.parent.get(siblingName)?.value as unknown;
    return value === sibling ? null : { mismatch: true };
  };
}
