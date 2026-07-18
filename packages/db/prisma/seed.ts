/* eslint-disable no-console */
import argon2 from 'argon2';
import { IdPrefix, newId, Role } from '@akp/core';
import { PrismaClient } from '@prisma/client';

/**
 * Idempotent development seed. Creates a demo organization with an owner and a
 * member so the app is immediately usable after `pnpm db:seed`.
 *
 * Credentials (development only):
 *   owner@acme.test  / Password123!
 *   member@acme.test / Password123!
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      id: newId(IdPrefix.organization),
      name: 'Acme Corporation',
      slug: 'acme',
    },
  });

  const seedUser = async (email: string, name: string, role: Role): Promise<void> => {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { id: newId(IdPrefix.user), email, name, passwordHash },
    });

    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role },
      create: {
        id: newId(IdPrefix.membership),
        organizationId: org.id,
        userId: user.id,
        role,
      },
    });
  };

  await seedUser('owner@acme.test', 'Ada Owner', Role.OWNER);
  await seedUser('member@acme.test', 'Ben Member', Role.MEMBER);

  console.log('Seed complete:');
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log('  owner@acme.test  / Password123!');
  console.log('  member@acme.test / Password123!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
