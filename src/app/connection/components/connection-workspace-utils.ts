export function getQuerySegment(query: string, position: number): string {
  const range = getQueryRange(query, position);
  return query.slice(range.from, range.to);
}

export function getQueryRange(query: string, position: number): { from: number; to: number } {
  const separators = findStatementSeparators(query);
  const previousSeparators = separators.filter((separator) => separator < position);
  const previousSeparator = previousSeparators[previousSeparators.length - 1];

  // A cursor immediately after a delimiter still belongs to the statement it closes.
  if (
    previousSeparator !== undefined &&
    query.slice(previousSeparator + 1, position).trim().length === 0
  ) {
    const statementStart = previousSeparators[previousSeparators.length - 2] ?? -1;
    return trimRange(query, statementStart + 1, previousSeparator + 1);
  }

  const statementStart = previousSeparator ?? -1;
  const nextSeparator = separators.find((separator) => separator >= position) ?? query.length;
  const end = nextSeparator < query.length ? nextSeparator + 1 : query.length;
  return trimRange(query, statementStart + 1, end);
}

function trimRange(query: string, from: number, to: number): { from: number; to: number } {
  while (from < to && /\s/.test(query[from] ?? "")) from += 1;
  while (to > from && /\s/.test(query[to - 1] ?? "")) to -= 1;
  return { from, to };
}

export function splitSqlStatements(query: string): string[] {
  const separators = findStatementSeparators(query);
  const statements: string[] = [];
  let start = 0;

  for (const separator of separators) {
    const statement = query.slice(start, separator + 1).trim();
    if (statement) statements.push(statement);
    start = separator + 1;
  }

  const trailingStatement = query.slice(start).trim();
  if (trailingStatement) statements.push(trailingStatement);
  return statements;
}

function findStatementSeparators(query: string): number[] {
  const separators: number[] = [];
  let quote: "'" | '"' | "`" | null = null;
  let dollarQuote: string | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const nextCharacter = query[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (dollarQuote) {
      if (query.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (nextCharacter === quote) index += 1;
        else quote = null;
      } else if (character === "\\") {
        index += 1;
      }
      continue;
    }
    if ((character === "-" && nextCharacter === "-") || character === "#") {
      lineComment = true;
      if (character === "-") index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "$") {
      const delimiter = query.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        dollarQuote = delimiter;
        index += delimiter.length - 1;
        continue;
      }
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === ";") separators.push(index);
  }
  return separators;
}
