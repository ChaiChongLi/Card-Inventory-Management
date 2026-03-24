import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { refreshInterceptor } from './core/interceptors/refresh.interceptor';
import { AuthService } from './core/services/auth.service';
import { PlatformService } from './core/services/platform.service';
import { PresetService } from './core/services/preset.service';

function initializeApp(
  authService: AuthService,
  platformService: PlatformService,
  presetService: PresetService,
): () => Promise<void> {
  return async () => {
    // Try to restore session from refresh cookie
    await authService.init();
    // Only load auth-protected resources if session was restored
    if (authService.isLoggedIn()) {
      await Promise.all([
        platformService.load(),
        presetService.load(),
      ]);
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService, PlatformService, PresetService],
      multi: true,
    },
  ],
};
