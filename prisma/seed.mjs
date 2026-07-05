// Idempotent seed (upserts) — safe to run repeatedly.
// Admin user: admin@coretasks.com / password
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@coretasks.com' },
    update: {},
    create: { name: 'Admin', lastName: 'Core', email: 'admin@coretasks.com', password },
  });

  const dev = await prisma.user.upsert({
    where: { email: 'dev@coretasks.com' },
    update: {},
    create: { name: 'Dev', lastName: 'Core', email: 'dev@coretasks.com', password },
  });

  const acme = await upsertClient({
    name: 'Acme Corp',
    company: 'Acme Corporation',
    email: 'contact@acme.com',
    phone: '+598 99 111 222',
    status: 'active',
  });
  const globex = await upsertClient({
    name: 'Globex',
    company: 'Globex International',
    email: 'hello@globex.com',
    status: 'active',
  });

  const website = await upsertProject(acme.id, {
    name: 'Corporate website',
    description: 'New institutional website with CMS.',
    status: 'active',
    startDate: new Date('2026-06-01'),
  });
  const app = await upsertProject(globex.id, {
    name: 'Mobile app MVP',
    description: 'Cross-platform MVP for field agents.',
    status: 'draft',
  });

  await upsertProposal(website.id, {
    title: 'Website redesign — phase 1',
    description: 'Discovery, UX and visual design.',
    amount: '4800.00',
    currency: 'USD',
    status: 'sent',
    sentAt: new Date('2026-06-10'),
  });
  await upsertProposal(app.id, {
    title: 'MVP scope & estimate',
    amount: '12500.00',
    currency: 'USD',
    status: 'draft',
  });

  const tasks = [
    { title: 'Define sitemap', status: 'done', priority: 'high', position: 0 },
    { title: 'Design home page', status: 'in_progress', priority: 'high', position: 0, assigneeId: dev.id },
    { title: 'Set up CMS', status: 'todo', priority: 'medium', position: 0 },
    { title: 'Content migration plan', status: 'todo', priority: 'low', position: 1 },
    { title: 'QA checklist', status: 'review', priority: 'medium', position: 0, assigneeId: admin.id },
  ];
  for (const t of tasks) {
    await upsertTask(website.id, t);
  }

  console.log('Seed OK');
}

async function upsertClient(data) {
  const existing = await prisma.client.findFirst({ where: { name: data.name, deletedAt: null } });
  if (existing) return existing;
  return prisma.client.create({ data });
}

async function upsertProject(clientId, data) {
  const existing = await prisma.project.findFirst({ where: { name: data.name, deletedAt: null } });
  if (existing) return existing;
  return prisma.project.create({ data: { ...data, clientId } });
}

async function upsertProposal(projectId, data) {
  const existing = await prisma.proposal.findFirst({ where: { title: data.title, deletedAt: null } });
  if (existing) return existing;
  return prisma.proposal.create({ data: { ...data, projectId } });
}

async function upsertTask(projectId, data) {
  const existing = await prisma.task.findFirst({ where: { title: data.title, projectId, deletedAt: null } });
  if (existing) return existing;
  return prisma.task.create({ data: { ...data, projectId } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
