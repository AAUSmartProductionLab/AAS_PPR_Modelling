import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Controls,
  Background,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type OnNodesDelete,
  type OnReconnect,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore, REQUIRED_SUBMODELS, type SubmodelKey } from '../../store/useAppStore';
import { SUBMODELS } from '../../aas/submodelRegistry';
import { applyConnection, removeConnectionForEdge } from './connectionRules';
import { useModelStore, SHELL_NODE_ID, createShellNodeId } from '../../store/useModelStore';
import { useValidation } from '../../hooks/useValidation';
import { nodeTypes } from './nodes/nodeTypes';
import { edgeTypes } from './edges/edgeTypes';
import { CatalogPanel } from './CatalogPanel';
import { BuilderToolbar } from './BuilderToolbar';
import { PropertyEditorModal } from './modals/PropertyEditorModal';
import { IdentityEditorModal } from './modals/IdentityEditorModal';
import { GuidancePanel } from '../shared/GuidancePanel';
import type { SubmodelNodeData } from './nodes/SubmodelNode';

// Positions are RELATIVE to the shell container (accounting for the header height)
const SHELL_HEADER_H = 70;
const SUBMODEL_START_X = 40;

// Inner component — must be inside ReactFlowProvider to use useReactFlow()
function ModelBuilderCanvas() {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const toggleSubmodel = useAppStore((s) => s.toggleSubmodel);
  const selectedSubmodels = useAppStore((s) => s.selectedSubmodels);
  const setActiveAasNode = useAppStore((s) => s.setActiveAasNode);
  const addAasNode = useAppStore((s) => s.addAasNode);
  const theme = useAppStore((s) => s.theme);
  const isLight = theme === 'light';

  const nodes = useModelStore((s) => s.nodes);
  const edges = useModelStore((s) => s.edges);
  const setNodes = useModelStore((s) => s.setNodes);
  const setEdges = useModelStore((s) => s.setEdges);
  const addShellNode = useModelStore((s) => s.addShellNode);
  const edgeLineType = useModelStore((s) => s.edgeLineType);

  // Render all edges with the selected built-in line type.
  const renderedEdges = edges.map((e) => {
    const currentType =
      e.type === 'default' || e.type === 'straight' || e.type === 'smoothstep' || e.type === 'step'
        ? e.type
        : undefined;
    const lineType = currentType ?? edgeLineType;

    if (lineType === 'step') {
      return {
        ...e,
        type: 'editableStep',
        data: { ...(e.data ?? {}) },
      };
    }

    return {
      ...e,
      type: lineType,
    };
  });

  useValidation();

  const seededRef = useRef(false);

  // Seed required submodel nodes on first mount — skip any already present (from persisted state)
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    const existing = useModelStore.getState().nodes;

    // Migrate: ensure all aasShell nodes persisted before dragHandle was added get it now
    const needsDragHandle = existing.filter((n) => n.type === 'aasShell' && !n.dragHandle);
    if (needsDragHandle.length > 0) {
      setNodes((prev) => prev.map((n) =>
        n.type === 'aasShell' ? { ...n, dragHandle: '.mb-drag-handle' } : n
      ));
    }

    const toAdd = REQUIRED_SUBMODELS.filter(
      (key) => !existing.some((n) => (n.data as SubmodelNodeData)?.submodelKey === key)
    );
    if (toAdd.length === 0) return;

    const newNodes: Node[] = toAdd.map((key, i) => ({
      id: `submodel-${key}-${crypto.randomUUID().slice(0, 8)}`,
      type: 'submodel',
      position: { x: SUBMODEL_START_X, y: SHELL_HEADER_H + i * 160 },
      parentId: SHELL_NODE_ID,
      extent: 'parent' as const,
      data: { submodelKey: key, parentId: SHELL_NODE_ID } satisfies SubmodelNodeData,
    }));

    setNodes((prev) => [...prev, ...newNodes]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev: Node[]) => applyNodeChanges(changes, prev));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Undo the profile mutation behind any edge being deleted (via rule.remove).
      const currentEdges = useModelStore.getState().edges;
      for (const change of changes) {
        if (change.type !== 'remove') continue;
        const edge = currentEdges.find((e) => e.id === change.id);
        if (edge) removeConnectionForEdge(edge);
      }
      setEdges((prev: Edge[]) => applyEdgeChanges(changes, prev));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      // The connection-rule registry applies the matching profile mutation and
      // returns the edge label (or null for a plain reference edge).
      const label = applyConnection(connection) ?? 'references';

      setEdges((prev: Edge[]) =>
        addEdge(
          {
            ...connection,
            type: edgeLineType === 'step' ? 'editableStep' : edgeLineType,
            label,
            labelStyle: { fill: '#94a3b8', fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif' },
            labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 },
            labelBgPadding: [4, 2] as [number, number],
            style: { stroke: '#475569' },
          },
          prev
        )
      );
    },
    [setEdges, edgeLineType]
  );

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      setEdges((prev) => {
        const reconnected = reconnectEdge(oldEdge, newConnection, prev);
        return reconnected.map((e) =>
          e.id === oldEdge.id
            ? { ...e, type: edgeLineType === 'step' ? 'editableStep' : edgeLineType }
            : e
        );
      });
    },
    [edgeLineType, setEdges]
  );

  const onNodesDelete: OnNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        if (node.type === 'submodel' && node.data?.submodelKey) {
          const key = node.data.submodelKey as SubmodelKey;
          if (selectedSubmodels.includes(key)) {
            toggleSubmodel(key);
          }
        }
      }
    },
    [selectedSubmodels, toggleSubmodel]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      // ── AAS Shell drop ──────────────────────────────────────────────────────
      const aasMarker = e.dataTransfer.getData('application/aas-shell');
      if (aasMarker === 'new') {
        const shellNodeId = createShellNodeId();
        const absPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addAasNode(shellNodeId);
        addShellNode(shellNodeId, { x: Math.max(0, absPos.x - 480), y: Math.max(0, absPos.y - 40) });
        return;
      }

      // ── Submodel drop ───────────────────────────────────────────────────────
      const key = e.dataTransfer.getData('application/submodel-key') as SubmodelKey;
      if (!key) return;

      // Convert screen coords to canvas coords
      const absPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // Use getNodes() for up-to-date positions (avoids stale closure over dragged shells)
      const liveNodes = getNodes();
      const shellNodes = liveNodes.filter((n) => n.type === 'aasShell');
      const targetShell = shellNodes.find((shell) => {
        const sx = shell.position.x;
        const sy = shell.position.y;
        const sw = (shell.style?.width as number) ?? 960;
        const sh = (shell.style?.height as number) ?? 600;
        return absPos.x >= sx && absPos.x <= sx + sw && absPos.y >= sy && absPos.y <= sy + sh;
      }) ?? shellNodes.find((n) => n.id === SHELL_NODE_ID) ?? shellNodes[0];

      if (!targetShell) return;

      // Cross-type guard: a submodel can only be dropped on a shell whose AAS
      // type it supports (Product submodel ✗ Resource shell, and vice versa).
      const targetType = useAppStore.getState().aasNodes[targetShell.id]?.aasType ?? 'Resource';
      if (!SUBMODELS[key].aasTypes.includes(targetType)) {
        return;
      }

      // Prevent duplicate submodels on the same AAS
      const alreadyExists = liveNodes.some(
        (n) => n.type === 'submodel' &&
          (n.data as SubmodelNodeData)?.submodelKey === key &&
          n.parentId === targetShell.id
      );
      if (alreadyExists) return;

      const shellPos = targetShell.position;
      const relX = Math.max(10, absPos.x - shellPos.x);
      const relY = Math.max(SHELL_HEADER_H + 10, absPos.y - shellPos.y);

      const nodeId = `submodel-${key}-${crypto.randomUUID().slice(0, 8)}`;

      const newNode: Node = {
        id: nodeId,
        type: 'submodel',
        position: { x: relX, y: relY },
        parentId: targetShell.id,
        extent: 'parent' as const,
        data: { submodelKey: key, parentId: targetShell.id } satisfies SubmodelNodeData,
      };

      setNodes((prev: Node[]) => [...prev, newNode]);

      // Switch active AAS to the shell this submodel was dropped onto
      setActiveAasNode(targetShell.id);

      // Sync selection state
      if (!selectedSubmodels.includes(key)) {
        toggleSubmodel(key);
      }
    },
    [getNodes, setNodes, screenToFlowPosition, toggleSubmodel, selectedSubmodels, setActiveAasNode, addAasNode, addShellNode]
  );

  return (
    <div className="mb-canvas-area">
      <ReactFlow
        nodes={nodes}
        edges={renderedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodesDelete={onNodesDelete}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesReconnectable
        reconnectRadius={24}
        defaultEdgeOptions={{ reconnectable: true }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode="Delete"
        className="mb-reactflow"
      >
        <Controls />
        <Background color={isLight ? '#cbd5e1' : '#334155'} gap={24} size={1} />
        <MiniMap
          nodeColor={(n) => (n.type === 'aasShell' ? '#38bdf8' : (isLight ? '#94a3b8' : '#475569'))}
          maskColor={isLight ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.75)'}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
        />
      </ReactFlow>
    </div>
  );
}

// Outer component — provides ReactFlowProvider + layout
export function ModelBuilder() {
  return (
    <div className="mb-shell">
      <BuilderToolbar />
      <div className="mb-body">
        <CatalogPanel />
        <div className="mb-canvas-col">
          <ReactFlowProvider>
            <ModelBuilderCanvas />
          </ReactFlowProvider>
          <GuidancePanel />
        </div>
      </div>
      <PropertyEditorModal />
      <IdentityEditorModal />
    </div>
  );
}
