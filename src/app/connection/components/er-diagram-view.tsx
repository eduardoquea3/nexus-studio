import { RiKey2Line, RiRefreshLine } from "@remixicon/react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useState, type ReactNode } from "react";

import type { ConnectionProfile, ErDiagramSchema } from "@/shared/types/models";

import { useErDiagram } from "@/app/connection/hooks/use-er-diagram";

import { erTableNodeId, layoutErDiagram, type ErTableNodeData } from "./er-diagram-layout";
import { getGridPosition } from "./er-diagram-layout-utils";

import "@xyflow/react/dist/style.css";

const nodeTypes = { erTable: ErTableNode };

export function ErDiagramView({
  profile,
  database,
}: {
  profile: ConnectionProfile;
  database: string;
}) {
  const { data, error, isPending, isFetching, refetch } = useErDiagram(
    profile,
    database,
    database.length > 0,
  );
  const [diagram, setDiagram] = useState<Awaited<ReturnType<typeof layoutErDiagram>>>();
  const [layoutPending, setLayoutPending] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setDiagram(undefined);
      return;
    }

    let cancelled = false;
    setLayoutPending(true);
    setLayoutError(null);
    void layoutErDiagram(data)
      .then((result) => {
        if (!cancelled) setDiagram(result);
      })
      .catch((layoutFailure: unknown) => {
        if (cancelled) return;
        setLayoutError(
          layoutFailure instanceof Error ? layoutFailure.message : String(layoutFailure),
        );
        setDiagram(createFallbackLayout(data));
      })
      .finally(() => {
        if (!cancelled) setLayoutPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const refresh = async () => {
    await refetch();
  };

  if (!database) {
    return (
      <DiagramMessage
        title="Select a database first"
        detail="The ER diagram is scoped to one database."
      />
    );
  }
  if (isPending) {
    return (
      <DiagramMessage title="Loading ER diagram" detail="Reading tables and foreign keys…" busy />
    );
  }
  if (error) {
    return (
      <DiagramMessage
        title="Could not load ER diagram"
        detail={error instanceof Error ? error.message : String(error)}
        action={
          <button type="button" className="er-diagram-action" onClick={() => void refetch()}>
            <RiRefreshLine aria-hidden="true" /> Retry
          </button>
        }
      />
    );
  }
  if (!data || data.tables.length === 0) {
    return <DiagramMessage title="No tables in this database" detail={`Database: ${database}`} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-background px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold">Entity relationship diagram</h2>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {data.tables.length} tables · {data.relationships.length} foreign-key relationships
            {diagram?.mode === "grid" ? " · low-memory layout; pan to explore" : ""}
            {layoutPending ? " · arranging…" : ""}
            {isFetching && !isPending ? " · refreshing…" : ""}
          </p>
        </div>
        <button
          type="button"
          className="er-diagram-icon-button"
          onClick={() => void refresh()}
          disabled={isFetching}
          aria-label="Refresh ER diagram"
          title="Refresh ER diagram"
        >
          <RiRefreshLine className={isFetching ? "animate-spin" : undefined} aria-hidden="true" />
        </button>
      </div>
      {layoutError ? (
        <p className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-[0.65rem] text-amber-700 dark:text-amber-300">
          Automatic layout failed; showing a basic arrangement. {layoutError}
        </p>
      ) : null}
      <div className="er-diagram-canvas min-h-0 flex-1">
        {diagram ? (
          <ReactFlowProvider>
            <DiagramCanvas
              nodes={diagram.nodes}
              edges={diagram.edges}
              fitAll={diagram.mode === "elk"}
            />
          </ReactFlowProvider>
        ) : null}
      </div>
    </div>
  );
}

function DiagramCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  fitAll,
}: {
  nodes: Node<ErTableNodeData>[];
  edges: Edge[];
  fitAll: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodesConnectable={false}
      onlyRenderVisibleElements
      fitView={fitAll}
      fitViewOptions={{ padding: 0.16, minZoom: 0.12, maxZoom: 1 }}
      minZoom={0.08}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      className="er-diagram-flow"
    >
      {fitAll ? <FitDiagramView revision={initialNodes} /> : null}
      <Background color="var(--border)" gap={22} size={1} />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

function FitDiagramView({ revision }: { revision: Node<ErTableNodeData>[] }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (revision.length === 0) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.16, minZoom: 0.12, maxZoom: 1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, revision]);
  return null;
}

function ErTableNode({ data }: NodeProps<Node<ErTableNodeData>>) {
  return (
    <article className="er-table-node">
      <Handle type="target" position={Position.Left} className="er-table-handle" />
      <header className="er-table-header">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">{data.tableName}</span>
          {data.schemaName ? (
            <span className="mt-0.5 block truncate text-[0.6rem] font-normal text-muted-foreground">
              {data.schemaName}
            </span>
          ) : null}
        </span>
        <span className="text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
          {data.totalColumnCount} cols
        </span>
      </header>
      <div className="er-table-columns">
        {data.columns.map((column) => (
          <div key={column.name} className="er-table-column">
            <span className="flex min-w-0 items-center gap-1.5">
              {column.isPrimaryKey ? (
                <RiKey2Line className="size-3 shrink-0 text-amber-500" aria-label="Primary key" />
              ) : (
                <span className="size-3 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{column.name}</span>
            </span>
            <span className="ml-2 shrink-0 text-[0.6rem] text-muted-foreground">
              {column.dataType}
              {column.nullable ? " · nullable" : ""}
            </span>
          </div>
        ))}
      </div>
      {data.hiddenColumnCount > 0 ? (
        <div className="border-t border-border px-2 py-1 text-[0.6rem] text-muted-foreground">
          {data.hiddenColumnCount} additional columns not shown
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="er-table-handle" />
    </article>
  );
}

function DiagramMessage({
  title,
  detail,
  busy = false,
  action,
}: {
  title: string;
  detail: string;
  busy?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-8 text-center">
      {busy ? <span className="er-diagram-spinner" aria-hidden="true" /> : null}
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="max-w-xl text-xs text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}

function createFallbackLayout(diagram: ErDiagramSchema) {
  const nodes: Node<ErTableNodeData>[] = diagram.tables.map((table, index) => ({
    id: erTableNodeId(table.schema, table.name),
    position: getGridPosition(index),
    data: {
      tableName: table.name,
      schemaName: table.schema,
      columns: table.columns,
      totalColumnCount: table.columnCount,
      hiddenColumnCount: Math.max(0, table.columnCount - table.columns.length),
    },
    type: "erTable",
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = diagram.relationships.flatMap((relationship, index) => {
    const source = erTableNodeId(relationship.sourceSchema, relationship.sourceTable);
    const target = erTableNodeId(relationship.targetSchema, relationship.targetTable);
    if (!nodeIds.has(source) || !nodeIds.has(target)) return [];
    return [
      {
        id: `fk:fallback:${index}:${source}:${target}`,
        source,
        target,
        type: "smoothstep",
        label: `${relationship.sourceColumn} → ${relationship.targetColumn}`,
      },
    ];
  });
  return { nodes, edges, mode: "grid" as const };
}
