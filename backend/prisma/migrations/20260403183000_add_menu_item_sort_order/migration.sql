ALTER TABLE "MenuItem"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_items AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY "name", id) - 1 AS position
  FROM "MenuItem"
)
UPDATE "MenuItem"
SET "sortOrder" = ranked_items.position
FROM ranked_items
WHERE "MenuItem".id = ranked_items.id;
