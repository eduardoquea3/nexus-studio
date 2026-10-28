export const ELK_TABLE_LIMIT = 120;
export const ELK_RELATIONSHIP_LIMIT = 400;
export const ELK_COLUMN_LIMIT = 5_000;

export function shouldUseElkLayout(
  tableCount: number,
  relationshipCount: number,
  columnCount: number,
): boolean {
  return (
    tableCount <= ELK_TABLE_LIMIT &&
    relationshipCount <= ELK_RELATIONSHIP_LIMIT &&
    columnCount <= ELK_COLUMN_LIMIT
  );
}

export function getGridPosition(index: number) {
  const columns = 6;
  return {
    x: 24 + (index % columns) * 320,
    y: 24 + Math.floor(index / columns) * 500,
  };
}
