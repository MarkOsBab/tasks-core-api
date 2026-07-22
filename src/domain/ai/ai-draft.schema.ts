import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import { lmsg, nullableString, reqEnum, reqString } from '@/lib/validation';
import { TASK_PRIORITY } from '../tasks/task.schema';

// Soft-delete-aware (extension filters findFirst): trashed projects are not valid tags.
async function projectExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const project = await prisma.project.findFirst({ where: { id: bigId }, select: { id: true } });
  return project !== null;
}

export const generateDraftsSchema = z
  .object({
    // Rough notes / meeting minutes / requirement dump the model turns into cards.
    input: reqString('input', 20000),
    // Optional pre-tag: every generated card is pinned to this project.
    projectId: nullableString('projectId'),
  })
  .superRefine(async (val, ctx) => {
    if (val.projectId != null && val.projectId !== '' && !(await projectExists(val.projectId))) {
      ctx.addIssue({
        path: ['projectId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('projectId'),
      });
    }
  });

const applyDraftSchema = z.object({
  columnId: reqString('columnId'),
  projectId: nullableString('projectId'),
  title: reqString('title', 255),
  description: nullableString('description'),
  priority: reqEnum('priority', TASK_PRIORITY).default('medium'),
  assigneeIds: z.array(z.string()).nullable().optional(),
  labelIds: z.array(z.string()).nullable().optional(),
  // Sub-steps persisted as checklist items on the created task.
  checklist: z.array(reqString('checklist item', 255)).max(30).nullable().optional(),
  // Machine-readable implementation spec, persisted as Task.aiMetadata for MCP agents.
  aiMetadata: z
    .object({
      acceptanceCriteria: z.array(z.string().max(500)).max(10).optional(),
      technicalNotes: z.string().max(4000).nullable().optional(),
      targetRepos: z.array(z.string().max(200)).max(5).optional(),
      dependsOnIndexes: z.array(z.number().int().min(0).max(29)).max(10).optional(),
    })
    .nullable()
    .optional(),
});

export type ApplyDraftInput = z.infer<typeof applyDraftSchema>;

/**
 * Bulk apply of reviewed drafts. Referenced ids are batch-validated here (one `in` query per
 * entity) instead of per-draft, so a 30-card accept doesn't fan out into 100+ existence checks.
 */
export const applyDraftsSchema = z
  .object({ drafts: z.array(applyDraftSchema).min(1).max(30) })
  .superRefine(async (val, ctx) => {
    const bigIds = (values: (string | null | undefined)[]) =>
      [...new Set(values.filter((v): v is string => v != null && v !== ''))]
        .map((id) => toBigIntOrUndefined(id))
        .filter((id): id is bigint => id !== undefined);

    const columnIds = bigIds(val.drafts.map((d) => d.columnId));
    const projectIds = bigIds(val.drafts.map((d) => d.projectId));
    const userIds = bigIds(val.drafts.flatMap((d) => d.assigneeIds ?? []));
    const labelIds = bigIds(val.drafts.flatMap((d) => d.labelIds ?? []));

    const [columns, projects, users, labels] = await Promise.all([
      prisma.boardColumn.findMany({ where: { id: { in: columnIds } }, select: { id: true } }),
      prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true } }),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } }),
      prisma.label.findMany({ where: { id: { in: labelIds } }, select: { id: true } }),
    ]);

    const issue = (attr: string) =>
      ctx.addIssue({ path: [attr], code: z.ZodIssueCode.custom, message: lmsg.selected(attr) });
    // A draft may reference fewer unique ids than sent (dupes are deduped above), so compare sets.
    if (columns.length !== columnIds.length) issue('columnId');
    if (projects.length !== projectIds.length) issue('projectId');
    if (users.length !== userIds.length) issue('assigneeIds');
    if (labels.length !== labelIds.length) issue('labelIds');
  });
