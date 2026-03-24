import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  BehaviorSubject,
  throwError,
  switchMap,
  filter,
  take,
  catchError,
  from,
  Observable,
} from 'rxjs';
import { AuthService } from '../services/auth.service';

// Sentinel value emitted on refresh failure to unblock waiting requests
const REFRESH_FAILED = '__REFRESH_FAILED__';

// Module-level state shared across all interceptor invocations
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function waitForNewToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token): Observable<HttpEvent<unknown>> => {
      if (token === REFRESH_FAILED) {
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      }
      return next(addToken(req, token));
    }),
  );
}

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip auth/refresh and login to avoid infinite loops
  if (req.url.includes('/auth/refresh') || req.url.includes('/auth/login')) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown): Observable<HttpEvent<unknown>> => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        return waitForNewToken(req, next);
      }

      isRefreshing = true;
      refreshTokenSubject.next(null);

      return from(authService.refreshToken()).pipe(
        switchMap(newToken => {
          isRefreshing = false;
          refreshTokenSubject.next(newToken);
          return next(addToken(req, newToken));
        }),
        catchError(refreshError => {
          isRefreshing = false;
          refreshTokenSubject.next(REFRESH_FAILED); // unblock any waiting requests
          refreshTokenSubject.next(null);            // reset for future refresh attempts
          authService.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
