import { NotFoundError } from '@akp/core';
import type { Organization, Role } from '@akp/db';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { OrganizationRepository } from './organization.repository.js';

export interface OrganizationMember {
  userId: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  joinedAt: string;
}

export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  async getById(organizationId: string): Promise<Organization> {
    const org = await this.organizations.findById(organizationId);
    if (!org) throw new NotFoundError('Organization');
    return org;
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const members = await this.memberships.listByOrganizationWithUsers(organizationId);
    return members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt.toISOString(),
    }));
  }
}
