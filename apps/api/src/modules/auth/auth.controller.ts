import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FeatureDisabledError, UnauthorizedError, ValidationError } from '@akp/core';
import type { Request } from 'express';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import { createOAuthState, verifyOAuthState } from '../../lib/oauth-state.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Public } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import type { RequestMeta } from './auth.types.js';
import {
  completeMfaBodySchema,
  googleCredentialBodySchema,
  googleExchangeBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from './auth.schemas.js';

const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

function requestMeta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get auth() {
    return this.container.services.auth;
  }

  private assertTrustedRedirect(redirectUri: string): void {
    const allowed = new Set<string>();
    const addOrigin = (raw: string) => {
      const base = raw.replace(/\/$/, '');
      if (base) allowed.add(`${base}${GOOGLE_CALLBACK_PATH}`);
    };
    addOrigin(this.container.config.web.publicUrl);
    for (const origin of this.container.config.server.corsOrigins) {
      addOrigin(origin);
    }
    if (!allowed.has(redirectUri)) {
      throw new ValidationError('redirectUri is not an allowed callback URL');
    }
  }

  private assertGoogleEnabled(): void {
    if (!this.container.config.google.enabled) {
      throw new FeatureDisabledError('Google sign-in is not configured');
    }
  }

  @Post('register')
  @Public()
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: z.infer<typeof registerBodySchema>,
    @Req() req: Request,
  ) {
    return this.auth.register(body, requestMeta(req));
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: z.infer<typeof loginBodySchema>,
    @Req() req: Request,
  ) {
    return this.auth.login(body, requestMeta(req));
  }

  @Post('mfa/complete')
  @Public()
  @HttpCode(200)
  async completeMfa(
    @Body(new ZodValidationPipe(completeMfaBodySchema))
    body: z.infer<typeof completeMfaBodySchema>,
    @Req() req: Request,
  ) {
    return this.auth.completeMfa(body, requestMeta(req));
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(refreshBodySchema)) body: z.infer<typeof refreshBodySchema>,
    @Req() req: Request,
  ) {
    return this.auth.refresh(body.refreshToken, requestMeta(req));
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(logoutBodySchema)) body: z.infer<typeof logoutBodySchema>,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken, requestMeta(req));
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentAuth() auth: AuthContext) {
    return this.auth.getProfile(auth.userId);
  }

  @Get('google/config')
  @Public()
  googleConfig() {
    const clientId = this.container.config.google.clientId ?? null;
    return {
      enabled: this.container.config.google.enabled,
      clientId,
    };
  }

  @Get('google/start')
  @Public()
  googleStart(
    @Query(new ZodValidationPipe(z.object({ redirectUri: z.string().url() })))
    query: { redirectUri: string },
  ) {
    this.assertGoogleEnabled();
    this.assertTrustedRedirect(query.redirectUri);
    const { state, codeChallenge } = createOAuthState(
      query.redirectUri,
      this.container.config.auth.accessSecret,
    );
    const authorizationUrl = this.container.googleOAuth.buildAuthorizationUrl({
      redirectUri: query.redirectUri,
      state,
      codeChallenge,
    });
    return { authorizationUrl, state };
  }

  @Post('google/exchange')
  @Public()
  @HttpCode(200)
  async googleExchange(
    @Body(new ZodValidationPipe(googleExchangeBodySchema))
    body: z.infer<typeof googleExchangeBodySchema>,
    @Req() req: Request,
  ) {
    this.assertGoogleEnabled();
    this.assertTrustedRedirect(body.redirectUri);

    const payload = verifyOAuthState(body.state, this.container.config.auth.accessSecret);
    if (!payload?.redirectUri || payload.redirectUri !== body.redirectUri) {
      throw new UnauthorizedError('Invalid or expired OAuth state');
    }

    const identity = await this.container.googleOAuth.exchangeCode({
      code: body.code,
      redirectUri: body.redirectUri,
      codeVerifier: payload.codeVerifier,
    });
    return this.auth.loginOrRegisterWithGoogle(identity, requestMeta(req));
  }

  @Post('google/credential')
  @Public()
  @HttpCode(200)
  async googleCredential(
    @Body(new ZodValidationPipe(googleCredentialBodySchema))
    body: z.infer<typeof googleCredentialBodySchema>,
    @Req() req: Request,
  ) {
    this.assertGoogleEnabled();
    const identity = await this.container.googleOAuth.verifyIdToken(body.idToken);
    return this.auth.loginOrRegisterWithGoogle(identity, requestMeta(req));
  }
}
