/** Up to two capital letters from a person's name: the first and the last word ("Priya Nair" → "PN"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  // Array.from keeps a letter outside the basic plane in one piece.
  const letter = (word: string) => Array.from(word)[0];
  const last = words.length > 1 ? letter(words[words.length - 1]) : '';
  return (letter(words[0]) + last).toUpperCase();
}
