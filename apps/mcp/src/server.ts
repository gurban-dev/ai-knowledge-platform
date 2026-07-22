import { createHash } from 'node:crypto';
import { fastify } from 'fastify';
import {
  IdPrefix,
  newId,
  RateLimitError,
  UnauthorizedError,
} from '@akp/core';
import type { Prisma, PrismaClient } from '@akp/db';
import type { Logger } from '@akp/observability';
import type { Redis } from 'ioredis';
import { assertToolAuthorized, MCP_TOOLS } from './tools.js';

export interface McpServerDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  apiBaseUrl: string;
}

function hashKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function extractApiKey(authorization?: string, xApiKey?: string): string | null {
  if (xApiKey?.trim()) return xApiKey.trim();
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && token?.startsWith('akp_')) return token.trim();
  return null;
}

export async function buildMcpServer(deps: McpServerDeps) {
  const app = fastify({ logger: false });

  app.get('/health/live', () => ({ status: 'ok' }));

  app.get('/mcp/tools', async (request) => {
    const key = extractApiKey(
      request.headers.authorization,
      typeof request.headers['x-api-key'] === 'string' ? request.headers['x-api-key'] : undefined,
    );
    if (!key) throw new UnauthorizedError('API key required');
    await verifyKey(deps, key);
    return { tools: MCP_TOOLS };
  });

  app.post<{
    Body: { tool: string; arguments?: Record<string, unknown> };
  }>('/mcp/call', async (request) => {
    const started = Date.now();
    const key = extractApiKey(
      request.headers.authorization,
      typeof request.headers['x-api-key'] === 'string' ? request.headers['x-api-key'] : undefined,
    );
    if (!key) throw new UnauthorizedError('API key required');
    const verified = await verifyKey(deps, key);

    const windowKey = `akp-mcp:${verified.id}:${Math.floor(Date.now() / 60_000)}`;
    const count = await deps.redis.incr(windowKey);
    if (count === 1) await deps.redis.expire(windowKey, 60);
    if (count > 50) {
      throw new RateLimitError('MCP tool call budget exceeded (50/min)');
    }

    const tool = MCP_TOOLS.find((t) => t.name === request.body.tool);
    if (!tool) {
      return { error: { message: `Unknown tool ${request.body.tool}` } };
    }
    assertToolAuthorized(verified.scopes, tool);

    try {
      const result = await invokeTool(deps, verified, tool.name, request.body.arguments ?? {});
      await deps.prisma.toolInvocation.create({
        data: {
          id: newId(IdPrefix.toolInvocation),
          organizationId: verified.organizationId,
          actorId: verified.id,
          toolName: tool.name,
          sideEffect: tool.sideEffect,
          status: 'SUCCEEDED',
          arguments: (request.body.arguments ?? {}) as Prisma.InputJsonValue,
          resultSummary: JSON.stringify(result).slice(0, 500),
          latencyMs: Date.now() - started,
        },
      });
      return { result };
    } catch (error) {
      await deps.prisma.toolInvocation.create({
        data: {
          id: newId(IdPrefix.toolInvocation),
          organizationId: verified.organizationId,
          actorId: verified.id,
          toolName: tool.name,
          sideEffect: tool.sideEffect,
          status: 'FAILED',
          arguments: (request.body.arguments ?? {}) as Prisma.InputJsonValue,
          latencyMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  });

  return app;
}

async function verifyKey(deps: McpServerDeps, secret: string) {
  const keyHash = hashKey(secret);
  const row = await deps.prisma.apiKey.findUnique({ where: { keyHash } });
  if (row?.status !== 'ACTIVE') {
    throw new UnauthorizedError('Invalid API key');
  }

  const expiresAt = row.expiresAt?.getTime();

  if (expiresAt !== undefined && expiresAt < Date.now()) {
    throw new UnauthorizedError('API key expired');
  }

  await deps.prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return row;
}

async function invokeTool(
  deps: McpServerDeps,
  key: { id: string; organizationId: string; scopes: string[] },
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': '', // tools call internal DB for read paths where possible
  };
  void headers;

  switch (toolName) {
    case 'search_knowledge': {
      // Proxy to API search using the same API key by reconstructing from hash is impossible;
      // perform a constrained DB lexical search for MCP autonomy when API proxy isn't available.
      const query = typeof args.query === 'string' ? args.query : '';
      const limit = Number(args.limit ?? 8);

      const rows = await deps.prisma.$queryRawUnsafe<
        { id: string; document_id: string; content: string; score: number }[]
      >(
        `SELECT c.id, c.document_id, c.content, similarity(c.content, $1)::float8 AS score
         FROM document_chunks c
         JOIN documents d ON d.id = c.document_id
         WHERE c.organization_id = $2 AND d.deleted_at IS NULL AND c.content % $1
         ORDER BY similarity(c.content, $1) DESC
         LIMIT $3`,
        query,
        key.organizationId,
        limit,
      );
      return { hits: rows };
    }
    case 'get_document': {
      const doc = await deps.prisma.document.findFirst({
        where: {
          id: String(args.documentId),
          organizationId: key.organizationId,
          deletedAt: null,
        },
      });
      return doc;
    }
    case 'list_collections': {
      return deps.prisma.collection.findMany({
        where: { organizationId: key.organizationId },
        take: 100,
      });
    }
    case 'ask_question': {
      const query = typeof args.question === 'string' ? args.question : '';

      const rows = await deps.prisma.$queryRawUnsafe<
        { content: string; title: string }[]
      >(
        `SELECT c.content, d.title
         FROM document_chunks c
         JOIN documents d ON d.id = c.document_id
         WHERE c.organization_id = $1 AND d.deleted_at IS NULL AND c.content % $2
         ORDER BY similarity(c.content, $2) DESC
         LIMIT 5`,
        key.organizationId,
        query,
      );
      if (rows.length === 0) {
        return {
          answer:
            "I don't have enough grounded information in the organization's knowledge base to answer confidently.",
          citations: [],
        };
      }
      return {
        answer: `Based on retrieved context from "${rows[0]!.title}": ${rows[0]!.content.slice(0, 500)}`,
        citations: rows.map((r, i) => ({ index: i + 1, title: r.title, snippet: r.content.slice(0, 200) })),
      };
    }
    default:
      throw new Error(`Unhandled tool ${toolName}`);
  }
}
