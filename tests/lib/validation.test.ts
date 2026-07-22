import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  lmsg,
  nullableBool,
  nullableEmail,
  nullableHexColor,
  nullableInt,
  nullableNumber,
  nullableString,
  optionalRequiredString,
  reqEnum,
  reqString,
} from '@/lib/validation';

function firstMessage(result: z.SafeParseReturnType<unknown, unknown>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('reqString', () => {
  it('requires a non-empty string and enforces max length', () => {
    const schema = reqString('title', 5);
    expect(firstMessage(schema.safeParse(undefined))).toBe('The title field is required.');
    expect(firstMessage(schema.safeParse(''))).toBe('The title field is required.');
    expect(firstMessage(schema.safeParse(7))).toBe('The title field must be a string.');
    expect(firstMessage(schema.safeParse('toolong'))).toBe(
      'The title field must not be greater than 5 characters.',
    );
    expect(schema.safeParse('ok').success).toBe(true);
  });
});

describe('optionalRequiredString', () => {
  it('allows the field to be absent but not empty', () => {
    const schema = optionalRequiredString('title');
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(firstMessage(schema.safeParse(''))).toBe('The title field is required.');
  });
});

describe('nullableString', () => {
  it('accepts null/absent and enforces type', () => {
    const schema = nullableString('description');
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(firstMessage(schema.safeParse(3))).toBe('The description field must be a string.');
  });
});

describe('reqEnum', () => {
  it('emits Laravel-style messages for missing and invalid values', () => {
    const schema = reqEnum('priority', ['low', 'high'] as const);
    expect(firstMessage(schema.safeParse(undefined))).toBe('The priority field is required.');
    expect(firstMessage(schema.safeParse('mid'))).toBe('The selected priority is invalid.');
    expect(schema.safeParse('low').success).toBe(true);
  });
});

describe('nullableInt', () => {
  it('enforces integer and minimum', () => {
    const schema = nullableInt('position', 0);
    expect(firstMessage(schema.safeParse(1.5))).toBe('The position field must be an integer.');
    expect(firstMessage(schema.safeParse(-1))).toBe('The position field must be at least 0.');
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse(3).success).toBe(true);
  });
});

describe('nullableNumber', () => {
  it('enforces number type and optional minimum', () => {
    const schema = nullableNumber('estimatedHours', 0);
    expect(firstMessage(schema.safeParse('2'))).toBe('The estimatedHours field must be a number.');
    expect(firstMessage(schema.safeParse(-0.5))).toBe(
      'The estimatedHours field must be at least 0.',
    );
    expect(schema.safeParse(2.5).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
  });
});

describe('nullableBool', () => {
  it('accepts booleans and null only', () => {
    const schema = nullableBool('isTerminal');
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(firstMessage(schema.safeParse('yes'))).toBe(
      'The isTerminal field must be true or false.',
    );
  });
});

describe('nullableHexColor', () => {
  it('accepts #rrggbb only', () => {
    const schema = nullableHexColor('color');
    expect(schema.safeParse('#12aB3f').success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(firstMessage(schema.safeParse('12ab3f'))).toBe(
      'The color field must be a valid hex color.',
    );
  });
});

describe('nullableEmail', () => {
  it('validates the address format', () => {
    const schema = nullableEmail('email');
    expect(schema.safeParse('a@b.com').success).toBe(true);
    expect(firstMessage(schema.safeParse('nope'))).toBe(
      'The email field must be a valid email address.',
    );
  });
});

describe('lmsg', () => {
  it('formats the shared Laravel-style messages', () => {
    expect(lmsg.unique('email')).toBe('The email has already been taken.');
    expect(lmsg.array('labelIds')).toBe('The labelIds field must be an array.');
    expect(lmsg.max('size', 100)).toBe('The size field must not be greater than 100.');
  });
});
