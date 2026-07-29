import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@akp/core';
import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/http.js';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import { createDocumentBodySchema, replaceAclsBodySchema } from './document.schemas.js';

function toDto(doc: {
  id: string;
  title: string;
  mimeType: string;
  status: string;
  byteSize: bigint;
  contentHash: string;
  sourceUri: string | null;
  dataSourceId: string | null;
  chunkingStrategy: string;
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    title: doc.title,
    mimeType: doc.mimeType,
    status: doc.status,
    byteSize: doc.byteSize.toString(),
    contentHash: doc.contentHash,
    sourceUri: doc.sourceUri,
    dataSourceId: doc.dataSourceId,
    chunkingStrategy: doc.chunkingStrategy,
    indexedAt: doc.indexedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Controller('v1/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get documents() {
    return this.container.services.documents;
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.MEMBER)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createDocumentBodySchema))
    body: z.infer<typeof createDocumentBodySchema>,
  ) {
    const doc = await this.documents.create({
      organizationId: auth.organizationId,
      userId: auth.userId,
      role: auth.role,
      title: body.title,
      content: body.content,
      mimeType: body.mimeType,
      dataSourceId: body.dataSourceId,
      metadata: body.metadata,
    });
    return toDto(doc);
  }

  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: z.infer<typeof paginationQuerySchema>,
  ) {
    const teamIds = await this.container.resolveTeamIds(auth.organizationId, auth.userId);
    const result = await this.documents.list(
      auth.organizationId,
      { userId: auth.userId, role: auth.role, teamIds },
      query.limit,
      query.cursor,
    );
    return {
      documents: result.documents.map(toDto),
      nextCursor: result.nextCursor,
    };
  }

  @Get(':id')
  async get(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(z.object({ id: z.string() }))) params: { id: string },
  ) {
    const teamIds = await this.container.resolveTeamIds(auth.organizationId, auth.userId);
    const doc = await this.documents.get(auth.organizationId, params.id, {
      userId: auth.userId,
      role: auth.role,
      teamIds,
    });
    return toDto(doc);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ADMIN)
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(z.object({ id: z.string() }))) params: { id: string },
  ): Promise<void> {
    const teamIds = await this.container.resolveTeamIds(auth.organizationId, auth.userId);
    await this.documents.softDelete(auth.organizationId, params.id, {
      userId: auth.userId,
      role: auth.role,
      teamIds,
    });
  }

  @Put(':id/acls')
  @Roles(Role.ADMIN)
  async replaceAcls(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(z.object({ id: z.string() }))) params: { id: string },
    @Body(new ZodValidationPipe(replaceAclsBodySchema))
    body: z.infer<typeof replaceAclsBodySchema>,
  ) {
    const teamIds = await this.container.resolveTeamIds(auth.organizationId, auth.userId);
    const entries = await this.documents.replaceAcls(
      auth.organizationId,
      params.id,
      { userId: auth.userId, role: auth.role, teamIds },
      body.entries,
    );
    return {
      entries: entries.map((e) => ({
        id: e.id,
        subjectType: e.subjectType,
        subjectId: e.subjectId,
        permission: e.permission,
      })),
    };
  }
}
