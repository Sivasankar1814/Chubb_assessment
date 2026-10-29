import { policyNumberFor } from './policy-number';

// The first six rows are the same examples as ClaimServiceTest.policyNumberIsTheProfilesWhenThereIsOneOtherwiseMarketAndUserId
// in claim-service: if one changes, the other must.
describe('policyNumberFor', () => {
  const withPolicy = { id: 1, policyNumber: 'POL-JP-0001' };
  const blank = { id: 12, policyNumber: '  ' };
  const none = { id: 12 };
  const bigId = { id: 12345 };

  it('is the profile number when there is one, whatever the market', () => {
    expect(policyNumberFor(withPolicy, 'JP')).toBe('POL-JP-0001');
    expect(policyNumberFor(withPolicy, 'SG')).toBe('POL-JP-0001');
  });

  it('is POL-<market>-<user id, four digits> when the profile has none (a blank one counts as none)', () => {
    expect(policyNumberFor(blank, 'SG')).toBe('POL-SG-0012');
    expect(policyNumberFor(none, 'SG')).toBe('POL-SG-0012');
    expect(policyNumberFor(none, 'JP')).toBe('POL-JP-0012');
    expect(policyNumberFor(bigId, 'HK')).toBe('POL-HK-12345');
  });

  it('is empty while it needs a market that is not chosen, or when nobody is known', () => {
    expect(policyNumberFor(none, null)).toBe('');
    expect(policyNumberFor(none, undefined)).toBe('');
    expect(policyNumberFor(undefined, 'SG')).toBe('');
    expect(policyNumberFor(null, 'SG')).toBe('');
  });

  it('still gives the profile number before a market is chosen', () => {
    expect(policyNumberFor(withPolicy, null)).toBe('POL-JP-0001');
  });
});
