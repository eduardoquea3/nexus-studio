export type ColumnTypeBadgeStyle = {
  label: string;
  className: string;
};

const typeBadgeGroups: Array<ColumnTypeBadgeStyle & { aliases: string[] }> = [
  { aliases: ["boolean", "bool"], label: "BOOL", className: "bg-accent text-accent-foreground" },
  {
    aliases: ["timestamptz", "timestamp with time zone"],
    label: "TSTZ",
    className: "bg-warning/15 text-warning",
  },
  { aliases: ["timestamp"], label: "STAMP", className: "bg-warning/15 text-warning" },
  { aliases: ["datetime"], label: "DTIME", className: "bg-warning/15 text-warning" },
  { aliases: ["date"], label: "DATE", className: "bg-warning/15 text-warning" },
  { aliases: ["time"], label: "TIME", className: "bg-warning/15 text-warning" },
  { aliases: ["interval"], label: "INTRVL", className: "bg-warning/15 text-warning" },
  { aliases: ["year"], label: "YEAR", className: "bg-warning/15 text-warning" },
  { aliases: ["tinyint", "int1"], label: "TINY", className: "bg-primary/15 text-primary" },
  { aliases: ["mediumint"], label: "MINT", className: "bg-primary/15 text-primary" },
  {
    aliases: ["smallint", "int2", "smallserial"],
    label: "SINT",
    className: "bg-primary/15 text-primary",
  },
  {
    aliases: ["bigint", "int8", "bigserial"],
    label: "BIGINT",
    className: "bg-primary/15 text-primary",
  },
  {
    aliases: ["integer", "int", "int4", "serial"],
    label: "INT",
    className: "bg-primary/15 text-primary",
  },
  {
    aliases: ["decimal", "numeric", "dec", "fixed", "money"],
    label: "DEC",
    className: "bg-primary/15 text-primary",
  },
  { aliases: ["double"], label: "DOUBLE", className: "bg-primary/15 text-primary" },
  { aliases: ["float"], label: "FLOAT", className: "bg-primary/15 text-primary" },
  { aliases: ["real"], label: "REAL", className: "bg-primary/15 text-primary" },
  {
    aliases: [
      "varchar",
      "nvarchar",
      "character varying",
      "national character varying",
      "national varchar",
    ],
    label: "VCHAR",
    className: "bg-success/15 text-success",
  },
  {
    aliases: ["char", "character", "nchar", "national char"],
    label: "CHAR",
    className: "bg-success/15 text-success",
  },
  {
    aliases: ["text", "tinytext", "mediumtext", "longtext", "ntext", "clob"],
    label: "TEXT",
    className: "bg-success/15 text-success",
  },
  { aliases: ["uuid"], label: "UUID", className: "bg-success/15 text-success" },
  { aliases: ["jsonb"], label: "JSONB", className: "bg-success/15 text-success" },
  { aliases: ["json"], label: "JSON", className: "bg-success/15 text-success" },
  {
    aliases: ["varbinary", "binary varying"],
    label: "VARBIN",
    className: "bg-secondary text-secondary-foreground",
  },
  { aliases: ["binary"], label: "BINARY", className: "bg-secondary text-secondary-foreground" },
  {
    aliases: ["blob", "tinyblob", "mediumblob", "longblob", "bytea"],
    label: "BLOB",
    className: "bg-secondary text-secondary-foreground",
  },
  { aliases: ["enum", "set"], label: "ENUM", className: "bg-success/15 text-success" },
  { aliases: ["bit"], label: "BIT", className: "bg-secondary text-secondary-foreground" },
];

function matchesType(type: string, alias: string): boolean {
  return type === alias || type.startsWith(`${alias} `) || type.startsWith(`${alias}(`);
}

export function getColumnTypeBadgeStyle(dataType: string): ColumnTypeBadgeStyle {
  const type = dataType.trim().toLowerCase();
  return (
    typeBadgeGroups.find((group) => group.aliases.some((alias) => matchesType(type, alias))) ?? {
      label: "OTHER",
      className: "bg-secondary text-secondary-foreground",
    }
  );
}
