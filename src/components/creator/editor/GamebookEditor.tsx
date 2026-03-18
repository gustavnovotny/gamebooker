'use client'

import { useState, useCallback } from 'react'
import NodeGraph from './NodeGraph'
import NodeDetailPanel from './NodeDetailPanel'
import PublishButton from './PublishButton'
import BrainstormChat from '../ai/BrainstormChat'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Node, Choice, Gamebook } from '@/lib/supabase/types'
import type { OutlineData } from '@/lib/llm/prompts/generate-outline'
import { ChevronLeft } from 'lucide-react'

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

  const handleNodePositionChange = useCallback(async (nodeId: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, x, y } : n))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('nodes') as any).update({ x, y }).eq('id', nodeId)
  }, [supabase])

  const handleOutlineGenerated = useCallback(async (outline: OutlineData) => {
    // Auto-layout nodes in a grid (LLM returns x/y=0)
    const COLS = 4
    const X_GAP = 220
    const Y_GAP = 160

    const nodeInserts = outline.nodes.map((n, i) => ({
      gamebook_id: gamebook.id,
      type: n.type,
      title: n.title,
      content: n.summary,
      is_start: n.is_start,
      x: (i % COLS) * X_GAP,
      y: Math.floor(i / COLS) * Y_GAP,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedNodes } = await (supabase.from('nodes') as any)
      .insert(nodeInserts)
      .select()

    if (!insertedNodes?.length) return

    // Map outline temp IDs → Supabase UUIDs (by insertion order)
    const idMap = new Map<string, string>()
    outline.nodes.forEach((outlineNode, i) => {
      if (insertedNodes[i]) idMap.set(outlineNode.id, insertedNodes[i].id)
    })

    const choiceInserts = outline.choices
      .filter((c) => idMap.has(c.from_node_id) && idMap.has(c.to_node_id))
      .map((c) => ({
        from_node_id: idMap.get(c.from_node_id)!,
        to_node_id: idMap.get(c.to_node_id)!,
        text: c.text,
        condition_item_id: null,
      }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedChoices } = await (supabase.from('choices') as any)
      .insert(choiceInserts)
      .select()

    setNodes(insertedNodes as Node[])
    setChoices((insertedChoices ?? []) as Choice[])
    setShowBrainstorm(false)
  }, [gamebook.id, supabase])

  return (
    <div className="h-screen flex flex-col">
      {/* Editor header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/tvorit" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-slate-900">{gamebook.title}</h1>
        </div>
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
            onNodePositionChange={handleNodePositionChange}
            onChoicesChange={setChoices}
          />
        </div>

        {/* Right panel: node detail */}
        {selectedNode && (
          <div className="w-80 border-l bg-white shrink-0">
            <NodeDetailPanel
              key={selectedNode.id}
              node={selectedNode}
              onSave={handleSaveNode}
              onGenerateText={handleGenerateText}
              onClose={() => setSelectedNodeId(null)}
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
            onOutlineGenerated={handleOutlineGenerated}
          />
        </div>
      )}
    </div>
  )
}
