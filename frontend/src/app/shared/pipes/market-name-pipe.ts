import { Pipe, PipeTransform } from '@angular/core';
import { MARKET_NAMES, Market } from '../../models/enums';

@Pipe({ name: 'marketName' })
export class MarketName implements PipeTransform {
  transform(value: Market | null | undefined): string {
    return value ? (MARKET_NAMES[value] ?? value) : '';
  }
}
