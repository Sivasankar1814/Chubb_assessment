import { FormControl } from '@angular/forms';
import { toIsoDate } from '../dates';
import { amountPrecision, notBlank, notInFuture, requiredWhen } from './claim-validators';

describe('amountPrecision', () => {
  const validate = (value: unknown) => amountPrecision()(new FormControl(value));

  it.each([12, 12.5, 0.01, 1234567890123.99])('accepts %s', (value) => {
    expect(validate(value)).toBeNull();
  });

  it('rejects more than 2 decimal places', () => {
    expect(validate(12.345)).toEqual({ amountDecimals: { maxFraction: 2 } });
  });

  it('rejects more than 13 digits before the point', () => {
    expect(validate(12345678901234)).toEqual({ amountTooLarge: { maxInteger: 13 } });
  });

  it('leaves an empty value to the required validator', () => {
    expect(validate(null)).toBeNull();
    expect(validate('')).toBeNull();
  });

  describe('with a fraction limit that follows the currency', () => {
    let decimals = 2;
    const validateByCurrency = (value: unknown) =>
      amountPrecision(13, () => decimals)(new FormControl(value));

    it('allows cents in a currency that has them, and only whole numbers in one that does not', () => {
      decimals = 2;
      expect(validateByCurrency(1250.5)).toBeNull();

      decimals = 0;
      expect(validateByCurrency(125000)).toBeNull();
      expect(validateByCurrency(1250.5)).toEqual({ amountDecimals: { maxFraction: 0 } });
    });

    it('is not asked for the limit until there is a value, so it can read state that is not built yet', () => {
      const limit = vi.fn(() => 2);

      amountPrecision(13, limit)(new FormControl(null));

      expect(limit).not.toHaveBeenCalled();
    });
  });
});

describe('notInFuture', () => {
  it('accepts today and the past, and no date at all', () => {
    expect(notInFuture(new FormControl(new Date()))).toBeNull();
    expect(notInFuture(new FormControl(new Date(2020, 0, 1)))).toBeNull();
    expect(notInFuture(new FormControl(null))).toBeNull();
  });

  it('rejects a date after today', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    expect(notInFuture(new FormControl(tomorrow))).toEqual({ futureDate: true });
  });
});

describe('notBlank', () => {
  it('rejects text that is only whitespace', () => {
    expect(notBlank(new FormControl('   '))).toEqual({ required: true });
    expect(notBlank(new FormControl(' a '))).toBeNull();
    expect(notBlank(new FormControl(''))).toBeNull();
  });
});

describe('requiredWhen', () => {
  it('only requires a value while the condition holds', () => {
    let needed = false;
    const control = new FormControl(
      '',
      requiredWhen(() => needed),
    );

    expect(control.valid).toBe(true);
    needed = true;
    control.updateValueAndValidity();
    expect(control.hasError('required')).toBe(true);
    control.setValue('because');
    expect(control.valid).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('uses the local calendar day, whatever the time zone', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
