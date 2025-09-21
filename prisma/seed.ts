// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { id: 'default-org-id' },
    update: {},
    create: {
      name: 'Default Organization',
      domain: 'default.com',
      settings: {
        create: {
          autoJoinEnabled: true,
          recordingEnabled: true,
          aiSummaryEnabled: true,
          languageDetection: true,
        },
      },
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@fireflies.ai' },
    update: {},
    create: {
      email: 'admin@fireflies.ai',
      name: 'Admin User',
      role: 'ADMIN',
      hashedPassword,
      organizationId: organization.id,
      settings: {
        create: {
          emailSummaries: true,
          slackNotifications: false,
          realTimeAlerts: true,
          summaryStyle: 'concise',
          languages: ['en'],
          autoTranscription: true,
          calendarSync: false,
          crmSync: false,
          dataRetentionDays: 365,
          shareAnalytics: true,
        },
      },
    },
  });

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@fireflies.ai' },
    update: {},
    create: {
      email: 'demo@fireflies.ai',
      name: 'Demo User',
      role: 'USER',
      hashedPassword: await bcrypt.hash('demo123', 10),
      organizationId: organization.id,
      settings: {
        create: {
          emailSummaries: true,
          slackNotifications: false,
          realTimeAlerts: true,
          summaryStyle: 'detailed',
          languages: ['en'],
          autoTranscription: true,
          calendarSync: true,
          crmSync: false,
          dataRetentionDays: 365,
          shareAnalytics: true,
        },
      },
    },
  });

  console.log('Seeding completed successfully');
  console.log('Created organization:', organization.name);
  console.log('Created admin user:', adminUser.email);
  console.log('Created demo user:', demoUser.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
