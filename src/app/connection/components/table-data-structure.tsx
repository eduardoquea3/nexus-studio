import type { Dispatch, SetStateAction } from "react";

import { RiRefreshLine } from "@remixicon/react";

import { Checkbox } from "@/components/animate-ui/components/radix/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StructureDraft = {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string;
  comment: string;
  is_pk: boolean;
};

type TableDataStructureProps = {
  structureDraft: StructureDraft[];
  setStructureDraft: Dispatch<SetStateAction<StructureDraft[]>>;
  isLoading: boolean;
  error: unknown;
};

export function TableDataStructure({
  structureDraft,
  setStructureDraft,
  isLoading,
  error,
}: TableDataStructureProps) {
  return isLoading ? (
    <div className="text-xs text-muted-foreground">Loading structure...</div>
  ) : error ? (
    <div className="text-xs text-destructive">Could not load table structure.</div>
  ) : (
    <div className="flex h-fit min-h-0 max-h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card/40">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Columns</div>
          <div className="text-[0.65rem] text-muted-foreground">
            Edit nullable, default and primary state locally.
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Button variant="ghost" size="icon-xs" className="rounded-full" disabled>
            <RiRefreshLine />
          </Button>
          <Button variant="ghost" size="icon-xs" className="rounded-full" disabled>
            +
          </Button>
        </div>
      </div>
      <div className="min-h-0 max-h-full overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted/90 text-left backdrop-blur-sm">
            <tr>
              {["Name", "Type", "Nullable", "Default Value", "Comment", "Primary"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="border-b border-r border-border/70 px-3 py-2 font-medium"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {structureDraft.map((column) => (
              <tr key={column.name} className="hover:bg-muted/40">
                <td className="border-b border-r border-border/50 px-3 py-2 font-medium text-foreground">
                  {column.name}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2 text-muted-foreground">
                  {column.data_type}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={column.nullable}
                      onCheckedChange={(value) =>
                        setStructureDraft((rows) =>
                          rows.map((row) =>
                            row.name === column.name ? { ...row, nullable: value === true } : row,
                          ),
                        )
                      }
                      size="sm"
                      type="button"
                      aria-label={`Nullable ${column.name}`}
                    />
                    <span>{column.nullable ? "YES" : "NO"}</span>
                  </div>
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2">
                  <Input
                    value={column.default}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setStructureDraft((rows) =>
                        rows.map((row) =>
                          row.name === column.name ? { ...row, default: nextValue } : row,
                        ),
                      );
                    }}
                    placeholder="(NULL)"
                    className="h-7 bg-background/70 text-xs"
                  />
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2">
                  <Input
                    value={column.comment}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setStructureDraft((rows) =>
                        rows.map((row) =>
                          row.name === column.name ? { ...row, comment: nextValue } : row,
                        ),
                      );
                    }}
                    placeholder="(NULL)"
                    className="h-7 bg-background/70 text-xs"
                  />
                </td>
                <td className="border-b border-border/50 px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={column.is_pk}
                      onCheckedChange={(value) =>
                        setStructureDraft((rows) =>
                          rows.map((row) =>
                            row.name === column.name ? { ...row, is_pk: value === true } : row,
                          ),
                        )
                      }
                      size="sm"
                      type="button"
                      aria-label={`Primary key ${column.name}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
