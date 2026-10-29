import { fakeToken } from '../../testing/fake-token';
import { decodeJwtPayload } from './jwt';
import { safeReturnUrl } from './return-url';

describe('decodeJwtPayload', () => {
  it('reads the claims of a token', () => {
    const payload = decodeJwtPayload(
      fakeToken({ sub: 'officer1', exp: 1_900_000_000, roles: ['OFFICER'] }),
    );

    expect(payload?.sub).toBe('officer1');
    expect(payload?.exp).toBe(1_900_000_000);
  });

  it('returns null for anything that is not a token', () => {
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('not-a-token')).toBeNull();
    expect(decodeJwtPayload('a.%%%.c')).toBeNull();
  });
});

describe('safeReturnUrl', () => {
  it('keeps same-app paths', () => {
    expect(safeReturnUrl('/claims/12?tab=history')).toBe('/claims/12?tab=history');
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    '/login',
  ])('falls back to the dashboard for %s', (url) => {
    expect(safeReturnUrl(url)).toBe('/dashboard');
  });
});
