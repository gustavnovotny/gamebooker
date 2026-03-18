'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Node, Choice } from '@/lib/supabase/types'

const NODE_COLORS: Record<string, string> = {
  story: '#6366f1',
  combat: '#ef4444',
  item_discovery: '#f59e0b',
  ending: '#10b981',
}

interface NodeGraphProps {
  nodes: Node[]
  choices: Choice[]
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
  onNodesChange: (nodes: Node[]) => void
  onChoicesChange: (choices: Choice[]) => void
}

export default function NodeGraph({
  nodes,
  choices,
  selectedNodeId,
  onNodeSelect,
  onNodesChange,
  onChoicesChange,
}: NodeGraphProps) {
  const rfNodes: RFNode[] = useMemo(() =>
    nodes.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      data: { label: n.title, type: n.type, is_start: n.is_start },
      selected: n.id === selectedNodeId,
      style: {
        background: NODE_COLORS[n.type] ?? '#6366f1',
        color: '#fff',
        borderRadius: 8,
        border: n.is_start ? '3px solid #1e1b4b' : 'none',
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 600,
        minWidth: 120,
      },
    })),
  [nodes, selectedNodeId])

  const rfEdges: Edge[] = useMemo(() =>
    choices.map((c) => ({
      id: c.id,
      source: c.from_node_id,
      target: c.to_node_id,
      label: c.text,
      animated: false,
    })),
  [choices])

  const [rfNodesState, setRfNodesState, onRFNodesChange] = useNodesState(rfNodes)
  const [rfEdgesState, setEdges, onRFEdgesChange] = useEdgesState(rfEdges)

  // Sync ReactFlow state when external props change (e.g. node added/removed)
  useEffect(() => {
    setRfNodesState(rfNodes)
  }, [rfNodes, setRfNodesState])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  // Persist node positions after drag
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, rfNode: RFNode) => {
      const updated = nodes.map((n) =>
        n.id === rfNode.id ? { ...n, x: rfNode.position.x, y: rfNode.position.y } : n
      )
      onNodesChange(updated)
    },
    [nodes, onNodesChange]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodesState}
        edges={rfEdgesState}
        onNodesChange={onRFNodesChange}
        onEdgesChange={onRFEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        onNodeDragStop={onNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
