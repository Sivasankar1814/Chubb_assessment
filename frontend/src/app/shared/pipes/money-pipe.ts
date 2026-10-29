import { Pipe, PipeTransform } from '@angular/core';
import { Market } from '../../models/enums';
import { formatMoney } from '../money';

/** `claim.claimAmount | money: claim.market` gives "¥125,000"; add `: true` for "¥125,000 (JPY)". */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(
    amount: number | string | null | undefined,
    market: Market | null | undefined,
    withCode = false,
  ): string {
    return formatMoney(amount, market, { code: withCode });
  }
}
