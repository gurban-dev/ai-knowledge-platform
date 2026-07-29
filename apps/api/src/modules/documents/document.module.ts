import { Module } from '@nestjs/common';
import { DocumentsController } from './document.controller.js';

@Module({
  controllers: [DocumentsController],
})
export class DocumentsModule {}
