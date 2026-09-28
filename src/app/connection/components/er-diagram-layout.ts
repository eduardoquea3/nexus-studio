import type { Edge, Node } from "@xyflow/react";

import ELK from "elkjs/lib/elk-api.js";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";

import type { ErDiagramSchema } from "@/shared/types/models";

import { getGridPosition, shouldUseElkLayout } from "./er-diagram-layout-utils";

export type ErTableNodeData = {
  tableName: string;
  schemaName?: string;
  columns: ErDiagramSchema["tables"][number]["columns"];
  totalColumnCount: number;
  hiddenColumnCount: number;
};

export type ErDiagramLayout = {
  nodes: Node<ErTableNodeData>[];
  edges: Edge[];
  mode: "elk" | "grid";
};

const nodeWidth = 260;
const rowHeight = 24;
const headerHeight = 42;
const maxColumnListHeight = 420;
const elk = new ELK({ workerUrl: elkWorkerUrl });

export function erTableNodeId(schema: string | undefined, table: string): string {
  return `table:${encodeURIComponent(schema ?? "")}:${encodeURIComponent(table)}`;
}

export async function layoutErDiagram(diagram: ErDiagramSchema): Promise<ErDiagramLayout> {
  const nodeByTable = new Map(
    diagram.tables.map((table) => [
      `${table.schema ?? ""}\u0000${table.name}`,
      erTableNodeId(table.schema, table.name),
    ]),
  );
  const nodes: Node<ErTableNodeData>[] = diagram.tables.map((table) => ({
    id: erTableNodeId(table.schema, table.name),
    position: { x: 0, y: 0 },
    data: {
      tableName: table.name,
      schemaName: table.schema,
      columns: table.columns,
      totalColumnCount: table.columnCount,
      hiddenColumnCount: Math.max(0, table.columnCount - table.columns.length),
    },
    width: nodeWidth,
    height:
      headerHeight +
      Math.min(Math.max(table.columns.length, 1) * rowHeight, maxColumnListHeight) +
      8,
    type: "erTable",
  }));
  const edges: Edge[] = diagram.relationships.flatMap((relationship, index) => {
    const source = nodeByTable.get(
      `${relationship.sourceSchema ?? ""}\u0000${relationship.sourceTable}`,
    );
    const target = nodeByTable.get(
      `${relationship.targetSchema ?? ""}\u0000${relationship.targetTable}`,
    );
    if (!source || !target) return [];
    return [
      {
        id: `fk:${index}:${source}:${relationship.sourceColumn}:${target}:${relationship.targetColumn}`,
        source,
        target,
        type: "smoothstep",
        label: `${relationship.sourceColumn} → ${relationship.targetColumn}`,
        labelStyle: { fill: "var(--foreground)", fontSize: 10 },
        labelBgStyle: { fill: "var(--background)", fillOpacity: 0.9 },
        style: { stroke: "var(--primary)", strokeWidth: 1.5 },
      },
    ];
  });

  if (nodes.length === 0) return { nodes, edges, mode: "elk" };

  const columnCount = diagram.tables.reduce((total, table) => total + table.columnCount, 0);
  if (!shouldUseElkLayout(nodes.length, edges.length, columnCount)) {
    return {
      nodes: nodes.map((node, index) => ({ ...node, position: getGridPosition(index) })),
      edges,
      mode: "grid",
    };
  }

  const graph = await elk.layout({
    id: "er-diagram",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width ?? nodeWidth,
      height: node.height ?? headerHeight,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });
  const positions = new Map(
    graph.children?.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]) ?? [],
  );

  return {
    nodes: nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })),
    edges,
    mode: "elk",
  };
}
