import { catchError, map, Observable, of, startWith } from 'rxjs';
import { ApiProblem, toApiProblem } from '../core/http/api-problem';

/** What a page shows while one request is in flight, after it succeeded, and after it failed. */
export type LoadState<T> =
  { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; problem: ApiProblem };

export function loadState<T>(source: Observable<T>): Observable<LoadState<T>> {
  return source.pipe(
    map((data): LoadState<T> => ({ state: 'ready', data })),
    catchError((err: unknown) => of<LoadState<T>>({ state: 'error', problem: toApiProblem(err) })),
    startWith<LoadState<T>>({ state: 'loading' }),
  );
}
