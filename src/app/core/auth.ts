import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { currentLang } from './i18n';
import { User } from './models';

const STORAGE_KEY = 'proppilot.session';

interface Session {
  token: string;
  user: User;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(readSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isLoggedIn = computed(() => !!this.session());

  async login(email: string, password: string) {
    const session = await firstValueFrom(
      this.http.post<Session>('/api/auth/login', { email, password }),
    );
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable: the session lives only in memory.
    }
  }

  logout() {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    void this.router.navigateByUrl('/login');
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.token();
  // X-Lang makes the API answer (errors, match reasons, AI output) in the UI language.
  const headers: Record<string, string> = { 'X-Lang': currentLang() };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const request = req.clone({ setHeaders: headers });
  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.endsWith('/auth/login')) auth.logout();
      return throwError(() => err);
    }),
  );
};

export const authGuard: CanActivateFn = () =>
  inject(Auth).isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);

export const guestGuard: CanActivateFn = () =>
  inject(Auth).isLoggedIn() ? inject(Router).createUrlTree(['/']) : true;
