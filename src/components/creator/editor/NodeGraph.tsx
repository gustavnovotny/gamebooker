'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type NodeChange,
  type EdgeChange,
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
  selectedChoiceId: string | null
  onNodeSelect: (nodeId: string) => void
  onChoiceSelect: (choiceId: string) => void
  onNodePositionChange: (nodeId: string, x: number, y: number) => void
  onNewConnection: (fromNodeId: string, toNodeId: string) => void
  onDeleteChoice: (choiceId: string) => void
}

export default function NodeGraph({
  nodes,
  choices,
  selectedNodeId,
  selectedChoiceId,
  onNodeSelect,
  onChoiceSelect,
  onNodePositionChange,
  onNewConnection,
  onDeleteChoice,
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
      label: c.text || '(bez textu)',
      animated: false,
      selected: c.id === selectedChoiceId,
    })),
  [choices, selectedChoiceId])

  const [rfNodesState, setRfNodesState, onRFNodesChange] = useNodesState(rfNodes)
  const [rfEdgesState, setEdges, onRFEdgesChange] = useEdgesState(rfEdges)

  // Sync ReactFlow state when external props change (e.g. node added/removed)
  useEffect(() => {
    setRfNodesState(rfNodes)
  }, [rfNodes, setRfNodesState])

  useEffect(() => {
    setEdges(rfEdges)
  }, [rfEdges, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        onNewConnection(params.source, params.target)
      }
    },
    [onNewConnection]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onRFEdgesChange(changes)
      changes.forEach((change) => {
        if (change.type === 'remove') onDeleteChoice(change.id)
      })
    },
    [onRFEdgesChange, onDeleteChoice]
  )

  // Persist node positions after drag
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, rfNode: RFNode) => {
      onNodePositionChange(rfNode.id, rfNode.position.x, rfNode.position.y)
    },
    [onNodePositionChange]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodesState}
        edges={rfEdgesState}
        onNodesChange={onRFNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        onEdgeClick={(_, edge) => onChoiceSelect(edge.id)}
        onNodeDragStop={onNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
