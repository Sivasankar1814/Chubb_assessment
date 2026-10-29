import { Pipe, PipeTransform } from '@angular/core';

/** UNDER_REVIEW becomes "Under review". */
@Pipe({ name: 'enumLabel' })
export class EnumLabel implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const text = value.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
