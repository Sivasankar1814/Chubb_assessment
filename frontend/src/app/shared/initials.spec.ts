import { initials } from './initials';

describe('initials', () => {
  it('uses the first and last word of a name', () => {
    expect(initials('Priya Nair')).toBe('PN');
    expect(initials('Somchai Prasert Jr')).toBe('SJ');
  });

  it('copes with one word, extra spaces and lower case', () => {
    expect(initials('Maria')).toBe('M');
    expect(initials('  wei   lim ')).toBe('WL');
  });

  it('falls back to a question mark for an empty name', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});
