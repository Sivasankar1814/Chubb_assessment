import { FormControl, FormGroup } from '@angular/forms';
import { PHONE_PATTERN, sameAs } from './user-validators';

describe('sameAs', () => {
  // A control is validated when it is built, before it is in the group, so judge it again once it is, as an edit does.
  function pair(password: string, confirm: string) {
    const group = new FormGroup({
      password: new FormControl(password),
      confirm: new FormControl(confirm, [sameAs('password')]),
    });
    group.controls.confirm.updateValueAndValidity();
    return group;
  }

  it('has nothing to compare with before it is in a group', () => {
    expect(new FormControl('secret1', [sameAs('password')]).errors).toBeNull();
  });

  it('passes when the two match', () => {
    expect(pair('secret1', 'secret1').controls.confirm.errors).toBeNull();
  });

  it('fails when they differ, including by case or a trailing space', () => {
    expect(pair('secret1', 'secret2').controls.confirm.errors).toEqual({ mismatch: true });
    expect(pair('secret1', 'Secret1').controls.confirm.errors).toEqual({ mismatch: true });
    expect(pair('secret1', 'secret1 ').controls.confirm.errors).toEqual({ mismatch: true });
  });

  it('leaves an empty confirmation to `required`', () => {
    expect(pair('secret1', '').controls.confirm.errors).toBeNull();
  });

  it('judges again once the confirm control is told the password moved', () => {
    const form = pair('secret1', 'secret1');
    form.controls.password.setValue('another1');
    form.controls.confirm.updateValueAndValidity();

    expect(form.controls.confirm.errors).toEqual({ mismatch: true });
  });
});

describe('PHONE_PATTERN', () => {
  it.each(['+65 9123 4567', '91234567', '+81-3-1234-5678'])('accepts %s', (phone) => {
    expect(PHONE_PATTERN.test(phone)).toBe(true);
  });

  it.each(['call me', '12345', '+1 (555) 123-4567', ''])('rejects "%s"', (phone) => {
    expect(PHONE_PATTERN.test(phone)).toBe(false);
  });
});
