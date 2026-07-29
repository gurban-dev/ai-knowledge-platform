import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Role } from '@akp/core';
import type { ApiKeyContext, AuthContext } from './auth.types.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const API_KEY_AUTH_KEY = 'apiKeyAuth';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const ApiKeyAuth = () => SetMetadata(API_KEY_AUTH_KEY, true);

export const Auth = () => SetMetadata('auth', true);

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<{ auth?: AuthContext | null }>();
    return request.auth!;
  },
);

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<{ apiKey?: ApiKeyContext | null }>();
    return request.apiKey!;
  },
);
