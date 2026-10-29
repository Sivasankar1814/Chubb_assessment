import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { today } from '../dates';

/**
 * CreateClaimRequest.claimAmount: @Digits(integer = 13, fraction = 2). The fraction limit may be a function, for a
 * form whose currency (and so its decimals) changes with the market: yen and rupiah have none. It is only called once
 * there is a value to check, so it may read state that does not exist yet when the control is created.
 */
export function amountPrecision(
  maxInteger = 13,
  maxFraction: number | (() => number) = 2,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const [integer = '', fraction = ''] = String(value).replace(/^-/, '').split('.');
    if (integer.replace(/^0+(?=\d)/, '').length > maxInteger) {
      return { amountTooLarge: { maxInteger } };
    }
    const limit = typeof maxFraction === 'function' ? maxFraction() : maxFraction;
    return fraction.length > limit ? { amountDecimals: { maxFraction: limit } } : null;
  };
}

/** CreateClaimRequest.incidentDate: @PastOrPresent. Compares calendar days, so any time today is fine. */
export function notInFuture(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  if (!(value instanceof Date)) {
    return null;
  }
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  return day.getTime() > today().getTime() ? { futureDate: true } : null;
}

/** Makes the control required only while `isRequired()` is true (for example, remarks for a rejection). */
export function requiredWhen(isRequired: () => boolean): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown;
    const empty = value === null || value === undefined || String(value).trim() === '';
    return isRequired() && empty ? { required: true } : null;
  };
}

/** Rejects input that is only whitespace, which @NotBlank would refuse anyway. */
export function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value as unknown;
  return typeof value === 'string' && value.length > 0 && value.trim() === ''
    ? { required: true }
    : null;
}
