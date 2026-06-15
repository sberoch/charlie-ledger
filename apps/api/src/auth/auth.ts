import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { db } from '../common/database/db';

export const auth = betterAuth({
  basePath: '/api/auth',
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:3000'],
  hooks: {
    // No self-signup (brief): close the public HTTP endpoint. ctx.request is
    // only set when the call arrives through the HTTP handler, so the
    // server-side auth.api.signUpEmail call in SettingsService.addUser (which
    // passes no request) is unaffected. disableSignUp can't be used here — it
    // would reject the server-side call too.
    before: createAuthMiddleware((ctx) => {
      if (ctx.path === '/sign-up/email' && ctx.request)
        throw new APIError('FORBIDDEN', {
          message: 'Sign-up is disabled — users are added from Settings',
        });
      return Promise.resolve();
    }),
  },
});
