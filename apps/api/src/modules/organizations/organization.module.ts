import { Module } from '@nestjs/common';
import { OrganizationsController } from './organization.controller.js';

@Module({
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
