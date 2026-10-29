import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth/auth-service';
import { NotificationService } from '../notifications/notification-service';
import { authInterceptor } from './auth-interceptor';
import { errorInterceptor } from './error-interceptor';
import { PUBLIC_REQUEST, SKIP_ERROR_NOTIFICATION } from './http-context';

function setup(signedIn = true) {
  sessionStorage.clear();
  if (signedIn) {
    sessionStorage.setItem(
      'claims.session',
      JSON.stringify({
        token: 'jwt-123',
        username: 'officer1',
        roles: ['OFFICER'],
        expiresAt: Date.now() + 3_600_000,
      }),
    );
  }
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const error = vi
    .spyOn(TestBed.inject(NotificationService), 'error')
    .mockImplementation(() => undefined);
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    navigate,
    error,
  };
}

describe('authInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('adds the bearer token to calls to our API', () => {
    const { http, controller } = setup();

    http.get('/api/claims').subscribe();

    expect(controller.expectOne('/api/claims').request.headers.get('Authorization')).toBe(
      'Bearer jwt-123',
    );
  });

  it('never sends the token anywhere else', () => {
    const { http, controller } = setup();

    http.get('https://other.example/api/claims').subscribe();
    http.get('/apiary/claims').subscribe();

    expect(
      controller.expectOne('https://other.example/api/claims').request.headers.has('Authorization'),
    ).toBe(false);
    expect(controller.expectOne('/apiary/claims').request.headers.has('Authorization')).toBe(false);
  });

  it('leaves public requests (the login call) alone', () => {
    const { http, controller } = setup();

    http
      .post('/api/auth/login', {}, { context: new HttpContext().set(PUBLIC_REQUEST, true) })
      .subscribe();

    expect(controller.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('sends nothing when nobody is signed in', () => {
    const { http, controller } = setup(false);

    http.get('/api/claims').subscribe();

    expect(controller.expectOne('/api/claims').request.headers.has('Authorization')).toBe(false);
  });
});

describe('errorInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const fail = (status: number, body: object = { message: 'nope' }) => ({
    body,
    init: { status, statusText: 'x' },
  });

  it('signs the user out and returns them to login on a 401 from a protected call', () => {
    const { http, controller, auth, navigate } = setup();
    http.get('/api/claims').subscribe({ error: () => undefined });

    controller.expectOne('/api/claims').flush(fail(401).body, fail(401).init);

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'expired' }) }),
    );
  });

  it('leaves a 401 from a public call (wrong password) to the caller', () => {
    const { http, controller, auth, navigate } = setup();
    let status = 0;
    http
      .post('/api/auth/login', {}, { context: new HttpContext().set(PUBLIC_REQUEST, true) })
      .subscribe({ error: (e: { status: number }) => (status = e.status) });

    controller.expectOne('/api/auth/login').flush(fail(401).body, fail(401).init);

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([0, 403, 500, 502])('tells the user about a %i', (status) => {
    const { http, controller, error } = setup();
    http.get('/api/claims').subscribe({ error: () => undefined });

    controller.expectOne('/api/claims').flush(fail(status).body, fail(status).init);

    expect(error).toHaveBeenCalledTimes(1);
  });

  it.each([400, 404, 409])('leaves a %i to whoever made the call', (status) => {
    const { http, controller, error } = setup();
    let seen = 0;
    http.get('/api/claims').subscribe({ error: (e: { status: number }) => (seen = e.status) });

    controller.expectOne('/api/claims').flush(fail(status).body, fail(status).init);

    expect(seen).toBe(status);
    expect(error).not.toHaveBeenCalled();
  });

  it('stays quiet when the caller shows the error itself', () => {
    const { http, controller, error } = setup();
    http
      .get('/api/claims', { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .subscribe({ error: () => undefined });

    controller.expectOne('/api/claims').flush(fail(403).body, fail(403).init);

    expect(error).not.toHaveBeenCalled();
  });
});
