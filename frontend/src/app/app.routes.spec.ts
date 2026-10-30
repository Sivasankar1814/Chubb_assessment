import { guestGuard } from './core/auth/guest-guard';
import { routes } from './app.routes';

describe('the routes the sign-in screen links to', () => {
  const route = (path: string) => routes.find((candidate) => candidate.path === path);

  it.each(['login', 'register', 'forgot-password'])('/%s is for visitors only', (path) => {
    expect(route(path)).toBeDefined(); // the lookup does find a route
    expect(route(path)?.canActivate).toEqual([guestGuard]);
  });

  it('sit outside the signed-in shell, so no session is needed to open them', () => {
    const shell = routes.find((candidate) => candidate.path === '');

    expect(shell?.canActivate).not.toEqual([guestGuard]);
    for (const path of ['register', 'forgot-password']) {
      expect(shell?.children?.some((child) => child.path === path)).toBe(false);
      expect(routes.indexOf(route(path)!)).toBeLessThan(routes.indexOf(shell!));
    }
  });
});
