'use client'

import { useState, useCallback } from 'react'
import NodeGraph from './NodeGraph'
import NodeDetailPanel from './NodeDetailPanel'
import PublishButton from './PublishButton'
import BrainstormChat from '../ai/BrainstormChat'
import { createClient } from '@/lib/supabase/client'
import type { Node, Choice, Gamebook } from '@/lib/supabase/types'

interface GamebookEditorProps {
  gamebook: Gamebook
  initialNodes: Node[]
  initialChoices: Choice[]
}

export default function GamebookEditor({
  gamebook,
  initialNodes,
  initialChoices,
}: GamebookEditorProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showBrainstorm, setShowBrainstorm] = useState(initialNodes.length === 0)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const supabase = createClient()

  const handleSaveNode = useCallback(async (updatedNode: Node) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('nodes') as any)
      .update({ title: updatedNode.title, content: updatedNode.content })
      .eq('id', updatedNode.id)

    setNodes((prev) => prev.map((n) => n.id === updatedNode.id ? updatedNode : n))
  }, [supabase])

  const handleGenerateText = useCallback(async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    setIsGenerating(true)
    const connectedIds = choices
      .filter((c) => c.from_node_id === nodeId)
      .map((c) => c.to_node_id)
    const connectedSummaries = nodes
      .filter((n) => connectedIds.includes(n.id))
      .map((n) => n.title)

    const response = await fetch('/api/ai/generate-node-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeType: node.type,
        nodeTitle: node.title,
        nodeSummary: node.title,
        gamebookTitle: gamebook.title,
        storyFoundation: gamebook.description ?? '',
        connectedNodeSummaries: connectedSummaries,
      }),
    })

    if (!response.ok || !response.body) {
      setIsGenerating(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''

    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, content: '' } : n))

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      const captured = text
      setNodes((prev) =>
        prev.map((n) => n.id === nodeId ? { ...n, content: captured } : n)
      )
    }

    // Persist to DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('nodes') as any).update({ content: text }).eq('id', nodeId)
    setIsGenerating(false)
  }, [nodes, choices, gamebook, supabase])

  return (
    <div className="h-screen flex flex-col">
      {/* Editor header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="font-bold text-slate-900">{gamebook.title}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBrainstorm((v) => !v)}
            className="text-sm text-indigo-600 hover:underline"
          >
            {showBrainstorm ? 'Skrýt AI asistenta' : 'AI asistent'}
          </button>
          <PublishButton
            gamebookId={gamebook.id}
            currentStatus={gamebook.status}
            onPublished={() => window.location.reload()}
          />
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node graph (center) */}
        <div className="flex-1">
          <NodeGraph
            nodes={nodes}
            choices={choices}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodesChange={setNodes}
            onChoicesChange={setChoices}
          />
        </div>

        {/* Right panel: node detail */}
        {selectedNode && (
          <div className="w-80 border-l bg-white shrink-0">
            <NodeDetailPanel
              node={selectedNode}
              onSave={handleSaveNode}
              onGenerateText={handleGenerateText}
              isGenerating={isGenerating}
            />
          </div>
        )}
      </div>

      {/* Bottom panel: AI brainstorm */}
      {showBrainstorm && (
        <div className="h-72 border-t bg-white shrink-0">
          <BrainstormChat
            gamebookId={gamebook.id}
            onOutlineGenerated={(outline) => {
              console.log('Outline generated:', outline)
            }}
          />
        </div>
      )}
    </div>
  )
}
