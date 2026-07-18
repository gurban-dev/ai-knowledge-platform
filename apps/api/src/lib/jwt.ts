import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { TokenExpiredError, TokenInvalidError } from './auth-errors.js';

/**
 * Stateless access-token signing/verification (HS256).
 *
 * Access tokens are short-lived and carry the minimal claims needed to make
 * authorization decisions without a database round-trip. Long-lived refresh
 * tokens are opaque and stored (hashed) server-side — they are NOT JWTs — so
 * they can be revoked, which stateless JWTs cannot.
 */
export interface AccessTokenClaims {
  /** User id (subject). */
  sub: string;
  /** Active organization id for this token. */
  org: string;
  /** Effective role within the active organization. */
  role: string;
  /** Session id this access token was minted from (for correlation/revocation). */
  sid: string;
}

export interface JwtConfig {
  secret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
}

export class JwtService {
  private readonly key: Uint8Array;

  constructor(private readonly config: JwtConfig) {
    this.key = new TextEncoder().encode(config.secret);
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ org: claims.org, role: claims.role, sid: claims.sid })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTtlSeconds}s`)
      .sign(this.key);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.org !== 'string' ||
        typeof payload.role !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw new TokenInvalidError('Access token is missing required claims');
      }
      return { sub: payload.sub, org: payload.org, role: payload.role, sid: payload.sid };
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw new TokenExpiredError();
      }
      if (error instanceof TokenInvalidError) throw error;
      throw new TokenInvalidError();
    }
  }
}
