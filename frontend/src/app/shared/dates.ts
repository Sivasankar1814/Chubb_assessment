/**
 * The backend's incidentDate is a timezone-less yyyy-MM-dd. Date#toISOString converts to UTC and can move it by
 * a day, so dates are always built and read from their local parts.
 */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
