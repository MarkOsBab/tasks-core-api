import type { BoardColumn } from '@prisma/client';

// Columns are all scalars; no eager relations needed for serialization.
export type BoardColumnRow = BoardColumn;
