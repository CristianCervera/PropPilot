import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, authGuard, authInterceptor, guestGuard } from './auth';

const session = {
  token: 'jwt-123',
  user: { id: 1, name: 'Admin PropPilot', email: 'admin@proppilot.dev', role: 'admin' },
};

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    auth: TestBed.inject(Auth),
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

async function loggedIn() {
  const ctx = setup();
  const pending = ctx.auth.login('admin@proppilot.dev', 'proppilot');
  ctx.backend.expectOne('/api/auth/login').flush(session);
  await pending;
  return ctx;
}

const guard = (fn: typeof authGuard) =>
  TestBed.runInInjectionContext(() => fn({} as never, {} as never));

describe('Auth', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('starts logged out', () => {
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.user()).toBeNull();
  });

  it('stores the session on login and restores it on reload', async () => {
    const { auth } = await loggedIn();
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.user()?.name).toBe('Admin PropPilot');
    expect(JSON.parse(localStorage.getItem('proppilot.session')!)).toEqual(session);

    TestBed.resetTestingModule();
    expect(setup().auth.token()).toBe('jwt-123');
  });

  it('adds the bearer token to API requests', async () => {
    const { http, backend } = await loggedIn();
    void firstValueFrom(http.get('/api/properties'));
    expect(backend.expectOne('/api/properties').request.headers.get('Authorization')).toBe('Bearer jwt-123');
  });

  it('logs out and goes to /login when the API answers 401', async () => {
    const { auth, http, backend, router } = await loggedIn();
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const req = firstValueFrom(http.get('/api/dashboard'));
    backend.expectOne('/api/dashboard').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(req).rejects.toMatchObject({ status: 401 });
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('proppilot.session')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('keeps the user on the login page when credentials are wrong', async () => {
    const { auth, backend, router } = setup();
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const pending = auth.login('admin@proppilot.dev', 'mal');
    backend.expectOne('/api/auth/login').flush({ message: 'Credenciales incorrectas' }, { status: 401, statusText: 'Unauthorized' });
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('guards private and guest-only routes', async () => {
    setup();
    expect(String(guard(authGuard))).toBe('/login');
    expect(guard(guestGuard)).toBe(true);

    TestBed.resetTestingModule();
    await loggedIn();
    expect(guard(authGuard)).toBe(true);
    expect(String(guard(guestGuard))).toBe('/');
  });
});
