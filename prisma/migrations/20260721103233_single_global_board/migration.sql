-- Single-board model: every task moves to the global board's columns (its projectId tag is
-- already denormalized), then the per-project boards are dropped. Column mapping: same name
-- (case-insensitive) -> same position -> first global column.

-- 0. Guarantee the global board exists with the default columns (fresh DBs without seed).
INSERT INTO boards (project_id, name, created_at, updated_at)
SELECT NULL, 'Tablero global', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM boards WHERE project_id IS NULL);

INSERT INTO board_columns (board_id, name, color, position, is_terminal, created_at, updated_at)
SELECT b.id, d.name, d.color, d.position, d.is_terminal, now(), now()
FROM boards b,
     (VALUES ('Pendiente', '#94a3b8', 0, false),
             ('En progreso', '#f59e0b', 1, false),
             ('En revisión', '#8b5cf6', 2, false),
             ('Terminada', '#22c55e', 3, true)) AS d(name, color, position, is_terminal)
WHERE b.project_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM board_columns c WHERE c.board_id = b.id);

-- 1. Remap tasks (including soft-deleted ones: they still reference columns) that live on a
--    project-board column onto the equivalent global column.
WITH global_cols AS (
  SELECT c.id, lower(c.name) AS lname, c.position
  FROM board_columns c
  JOIN boards b ON b.id = c.board_id
  WHERE b.project_id IS NULL
),
mapping AS (
  SELECT t.id AS task_id,
         COALESCE(
           (SELECT gc.id FROM global_cols gc WHERE gc.lname = lower(src.name) ORDER BY gc.position LIMIT 1),
           (SELECT gc.id FROM global_cols gc WHERE gc.position = src.position ORDER BY gc.id LIMIT 1),
           (SELECT gc.id FROM global_cols gc ORDER BY gc.position LIMIT 1)
         ) AS new_column_id
  FROM tasks t
  JOIN board_columns src ON src.id = t.column_id
  JOIN boards b ON b.id = src.board_id
  WHERE b.project_id IS NOT NULL
)
UPDATE tasks t
SET column_id = m.new_column_id
FROM mapping m
WHERE t.id = m.task_id;

-- 2. Reindex live-task positions per global column (arrivals keep their relative order, ties by id).
WITH ranked AS (
  SELECT t.id, ROW_NUMBER() OVER (PARTITION BY t.column_id ORDER BY t.position, t.id) - 1 AS new_pos
  FROM tasks t
  JOIN board_columns c ON c.id = t.column_id
  JOIN boards b ON b.id = c.board_id
  WHERE b.project_id IS NULL AND t.deleted_at IS NULL
)
UPDATE tasks t
SET position = r.new_pos
FROM ranked r
WHERE t.id = r.id;

-- 3. Drop the per-project boards (their columns cascade; no task references them anymore).
DELETE FROM boards WHERE project_id IS NOT NULL;
