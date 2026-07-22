import { vi, type Mock } from 'vitest';

// Auto-mocking stand-in for the Prisma client: any `prismaMock.<model>.<method>` access lazily
// creates (and caches) a `vi.fn()`, so repositories/services run without a database. Usage:
//
//   const prismaMock = createPrismaMock();
//   vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, rawExists: vi.fn() }));
//   prismaMock.task.findMany.mockResolvedValue([...]);
//
// `$transaction` works out of the box: with an array it awaits every promise, with a callback
// it invokes it passing the mock itself as the tx client. External services (SES mailer, OpenAI,
// Supabase storage) are plain modules — mock them per test with `vi.mock('@/lib/mailer')` etc.

type ModelMock = Record<string, Mock>;

export type PrismaMock = {
  $transaction: Mock;
  $queryRaw: Mock;
  $executeRaw: Mock;
} & Record<string, ModelMock>;

export function createPrismaMock(): PrismaMock {
  const cache: Record<string, unknown> = {};
  const root: PrismaMock = new Proxy(cache, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      if (!(prop in target)) {
        if (prop === '$transaction') {
          target[prop] = vi.fn(async (arg: unknown) =>
            typeof arg === 'function'
              ? (arg as (tx: PrismaMock) => unknown)(root)
              : Promise.all(arg as Array<Promise<unknown>>),
          );
        } else if (prop.startsWith('$')) {
          target[prop] = vi.fn();
        } else {
          const methods: ModelMock = {};
          target[prop] = new Proxy(methods, {
            get(model, method) {
              if (typeof method !== 'string' || method === 'then') return undefined;
              model[method] ??= vi.fn();
              return model[method];
            },
          });
        }
      }
      return target[prop];
    },
  }) as PrismaMock;
  return root;
}
