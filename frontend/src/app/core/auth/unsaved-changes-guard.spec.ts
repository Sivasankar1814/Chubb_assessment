import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ConfirmService } from '../../shared/components/confirm-service';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes-guard';

describe('unsavedChangesGuard', () => {
  const confirm = vi.fn();

  function run(component: HasUnsavedChanges): boolean | Observable<boolean> {
    TestBed.configureTestingModule({
      providers: [{ provide: ConfirmService, useValue: { confirm } }],
    });
    return TestBed.runInInjectionContext(
      () =>
        unsavedChangesGuard(
          component,
          {} as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
          {} as RouterStateSnapshot,
        ) as boolean | Observable<boolean>,
    );
  }

  beforeEach(() => confirm.mockReset().mockReturnValue(of(false)));

  it('lets a clean form go without asking', () => {
    expect(run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks about a claim unless the page says what it holds', () => {
    run({ hasUnsavedChanges: () => true });

    expect(confirm.mock.calls[0][0]).toMatchObject({ title: 'Discard this claim?' });
  });

  it('names what would be lost', () => {
    run({ hasUnsavedChanges: () => true, discardSubject: 'user' });

    expect(confirm.mock.calls[0][0]).toMatchObject({ title: 'Discard this user?' });
  });
});
