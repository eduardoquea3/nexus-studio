export function getQuerySegment(query: string, position: number): string {
  const separators = findStatementSeparators(query);
  const lastSeparator = separators[separators.length - 1];

  if (lastSeparator !== undefined && position > lastSeparator) {
    const trailingText = query.slice(lastSeparator + 1);
    if (trailingText.trim().length === 0) {
      const previousSeparator = separators[separators.length - 2] ?? -1;
      return query.slice(previousSeparator + 1, query.length).trim();
    }
  }

  const previousSeparators = separators.filter((separator) => separator < position);
  const previousSeparator = previousSeparators[previousSeparators.length - 1] ?? -1;
  const nextSeparator = separators.find((separator) => separator >= position) ?? query.length;
  const end = nextSeparator < query.length ? nextSeparator + 1 : query.length;
  return query.slice(previousSeparator + 1, end).trim();
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
