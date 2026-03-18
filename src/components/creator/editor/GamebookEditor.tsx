'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import NodeGraph from './NodeGraph'
import NodeDetailPanel from './NodeDetailPanel'
import ChoiceDetailPanel from './ChoiceDetailPanel'
import PublishButton from './PublishButton'
import BrainstormChat from '../ai/BrainstormChat'
import ItemsLibraryModal from './ItemsLibraryModal'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Node, Choice, Gamebook, NodeType, CombatConfig, Item, NodeItem } from '@/lib/supabase/types'
import type { OutlineData } from '@/lib/llm/prompts/generate-outline'
import { ChevronLeft } from 'lucide-react'

interface GamebookEditorProps {
  gamebook: Gamebook
  initialNodes: Node[]
  initialChoices: Choice[]
  initialCombatConfigs: CombatConfig[]
  initialItems: Item[]
  initialNodeItems: NodeItem[]
}

export default function GamebookEditor({
  gamebook,
  initialNodes,
  initialChoices,
  initialCombatConfigs,
  initialItems,
  initialNodeItems,
}: GamebookEditorProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  const [combatConfigs, setCombatConfigs] = useState<CombatConfig[]>(initialCombatConfigs)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [showBrainstorm, setShowBrainstorm] = useState(initialNodes.length === 0)
  const [storyFoundation, setStoryFoundation] = useState(gamebook.description ?? '')
  const [editingFoundation, setEditingFoundation] = useState(false)
  const [items, setItems] = useState<Item[]>(initialItems)
  const [nodeItems, setNodeItems] = useState<NodeItem[]>(initialNodeItems)
  const [showItemsLibrary, setShowItemsLibrary] = useState(false)

  const nodeItemsRef = useRef(nodeItems)
  useEffect(() => { nodeItemsRef.current = nodeItems }, [nodeItems])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedChoice = choices.find((c) => c.id === selectedChoiceId) ?? null
  const supabase = createClient()

  const handleSaveNode = useCallback(async (updatedNode: Node) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('nodes') as any)
      .update({ title: updatedNode.title, summary: updatedNode.summary, content: updatedNode.content })
      .eq('id', updatedNode.id)

    setNodes((prev) => prev.map((n) => n.id === updatedNode.id ? updatedNode : n))
  }, [supabase])

  const handleSaveFoundation = useCallback(async (value: string) => {
    setStoryFoundation(value)
    setEditingFoundation(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('gamebooks') as any).update({ description: value }).eq('id', gamebook.id)
  }, [supabase, gamebook.id])

  const handleGenerateText = useCallback(async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    setIsGenerating(true)

    // Build ancestor chain going 2 levels back.
    // Each ancestor: the node + the choice text that leads FORWARD from it.
    type AncestorEntry = { nodeId: string; choiceTextLeadingForward: string }
    const buildAncestors = (targetId: string, depth: number): AncestorEntry[] => {
      if (depth === 0) return []
      const incoming = choices.filter((c) => c.to_node_id === targetId)
      if (incoming.length === 0) return []
      // Pick first incoming path (most common case; branching handled by per-node generation)
      const choice = incoming[0]
      const deeper = buildAncestors(choice.from_node_id, depth - 1)
      return [...deeper, { nodeId: choice.from_node_id, choiceTextLeadingForward: choice.text }]
    }

    const ancestorEntries = buildAncestors(nodeId, 2)
    const ancestors = ancestorEntries.map((entry) => {
      const n = nodes.find((nd) => nd.id === entry.nodeId)
      return {
        nodeTitle: n?.title ?? '',
        nodeSummary: n?.summary ?? '',
        nodeContent: n?.content ?? '',
        choiceTextLeadingForward: entry.choiceTextLeadingForward,
      }
    })

    // Outgoing: direct children
    const outgoingNodes = choices
      .filter((c) => c.from_node_id === nodeId)
      .map((c) => {
        const toNode = nodes.find((n) => n.id === c.to_node_id)
        return { title: toNode?.title ?? '', summary: toNode?.summary ?? '' }
      })

    const response = await fetch('/api/ai/generate-node-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeType: node.type,
        nodeTitle: node.title,
        nodeSummary: node.summary ?? '',
        gamebookTitle: gamebook.title,
        storyFoundation,
        ancestors,
        outgoingNodes,
      }),
    })

    if (!response.ok || !response.body) {
      setIsGenerating(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''

    setStreamingContent('')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      setStreamingContent(text)
    }

    // Streaming done — update nodes state once and persist
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, content: text } : n))
    setStreamingContent(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('nodes') as any).update({ content: text }).eq('id', nodeId)
    setIsGenerating(false)
  }, [nodes, choices, gamebook, supabase])

  const handleSaveCombatConfig = useCallback(async (
    config: Omit<CombatConfig, 'id'> & { id?: string }
  ) => {
    if (config.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('combat_configs') as any)
        .update(config).eq('id', config.id).select().single()
      if (data) setCombatConfigs((prev) => prev.map((c) => c.id === config.id ? data as CombatConfig : c))
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('combat_configs') as any)
        .insert(config).select().single()
      if (data) setCombatConfigs((prev) => [...prev, data as CombatConfig])
    }
  }, [supabase])

  const handleCreateItem = useCallback(async (
    item: Omit<Item, 'id' | 'gamebook_id'>
  ): Promise<Item> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('items') as any)
      .insert({ ...item, gamebook_id: gamebook.id })
      .select()
      .single()
    const newItem = data as Item
    setItems((prev) => [...prev, newItem])
    return newItem
  }, [supabase, gamebook.id])

  const handleUpdateItem = useCallback(async (item: Item): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('items') as any)
      .update({
        name: item.name,
        description: item.description,
        stat_bonus_attribute: item.stat_bonus_attribute,
        stat_bonus_value: item.stat_bonus_value,
      })
      .eq('id', item.id)
    setItems((prev) => prev.map((i) => i.id === item.id ? item : i))
  }, [supabase])

  const handleDeleteItem = useCallback(async (itemId: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('items') as any).delete().eq('id', itemId)
    // node_items cascade automatically (FK ON DELETE CASCADE); update local state to match
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    setNodeItems((prev) => prev.filter((ni) => ni.item_id !== itemId))
  }, [supabase])

  const handleAssignItem = useCallback(async (
    nodeId: string, itemId: string
  ): Promise<void> => {
    // Guard: prevent duplicate (use ref to avoid stale closure without dep array churn)
    if (nodeItemsRef.current.some((ni) => ni.node_id === nodeId && ni.item_id === itemId)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('node_items') as any)
      .insert({ node_id: nodeId, item_id: itemId })
    setNodeItems((prev) => [...prev, { node_id: nodeId, item_id: itemId }])
  }, [supabase])

  const handleUnassignItem = useCallback(async (
    nodeId: string, itemId: string
  ): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('node_items') as any)
      .delete()
      .eq('node_id', nodeId)
      .eq('item_id', itemId)
    setNodeItems((prev) =>
      prev.filter((ni) => !(ni.node_id === nodeId && ni.item_id === itemId))
    )
  }, [supabase])

  const handleNewConnection = useCallback(async (fromNodeId: string, toNodeId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newChoice } = await (supabase.from('choices') as any)
      .insert({ from_node_id: fromNodeId, to_node_id: toNodeId, text: '', condition_item_id: null })
      .select()
      .single()
    if (!newChoice) return
    setChoices((prev) => [...prev, newChoice as Choice])
    setSelectedChoiceId(newChoice.id)
    setSelectedNodeId(null)
  }, [supabase])

  const handleSaveChoice = useCallback(async (updated: Choice) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('choices') as any).update({ text: updated.text }).eq('id', updated.id)
    setChoices((prev) => prev.map((c) => c.id === updated.id ? updated : c))
  }, [supabase])

  const handleDeleteChoice = useCallback(async (choiceId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('choices') as any).delete().eq('id', choiceId)
    setChoices((prev) => prev.filter((c) => c.id !== choiceId))
    setSelectedChoiceId(null)
  }, [supabase])

  const handleAddNode = useCallback(async (
    fromNodeId: string,
    type: NodeType,
    title: string,
    choiceText: string,
  ) => {
    const fromNode = nodes.find((n) => n.id === fromNodeId)
    if (!fromNode) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newNode } = await (supabase.from('nodes') as any)
      .insert({
        gamebook_id: gamebook.id,
        type,
        title,
        content: '',
        is_start: false,
        x: fromNode.x + 50,
        y: fromNode.y + 160,
      })
      .select()
      .single()

    if (!newNode) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newChoice } = await (supabase.from('choices') as any)
      .insert({ from_node_id: fromNodeId, to_node_id: newNode.id, text: choiceText, condition_item_id: null })
      .select()
      .single()

    setNodes((prev) => [...prev, newNode as Node])
    if (newChoice) setChoices((prev) => [...prev, newChoice as Choice])
  }, [nodes, gamebook.id, supabase])

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
      summary: n.summary,
      content: '',
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

    // Persist AI-suggested items (append to existing items — don't replace)
    if (outline.suggested_items?.length) {
      const itemInserts = outline.suggested_items.map((item) => ({
        gamebook_id: gamebook.id,
        name: item.name,
        description: item.description ?? '',
        stat_bonus_attribute: item.stat_bonus_attribute,
        stat_bonus_value: item.stat_bonus_value ?? 0,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedItems } = await (supabase.from('items') as any)
        .insert(itemInserts)
        .select()
      if (insertedItems) setItems((prev) => [...prev, ...(insertedItems as Item[])])
    }

    // Persist story foundation extracted from the brainstorm conversation
    if (outline.story_foundation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('gamebooks') as any)
        .update({ description: outline.story_foundation })
        .eq('id', gamebook.id)
      setStoryFoundation(outline.story_foundation)
    }

    setShowBrainstorm(false)
  }, [gamebook.id, supabase])

  return (
    <div className="h-screen flex flex-col">
      {/* Editor header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/tvorit" className="text-slate-400 hover:text-slate-700 transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 leading-tight">{gamebook.title}</h1>
            {editingFoundation ? (
              <input
                autoFocus
                defaultValue={storyFoundation}
                onBlur={(e) => handleSaveFoundation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveFoundation(e.currentTarget.value)
                  if (e.key === 'Escape') setEditingFoundation(false)
                }}
                className="mt-0.5 text-xs text-slate-500 w-72 border-b border-indigo-400 outline-none bg-transparent"
                placeholder="Základ příběhu — svět, tón, hlavní téma…"
              />
            ) : (
              <button
                onClick={() => setEditingFoundation(true)}
                className="mt-0.5 text-xs text-slate-400 hover:text-slate-600 truncate max-w-xs block text-left"
              >
                {storyFoundation || '+ Přidat základ příběhu'}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBrainstorm((v) => !v)}
            className="text-sm text-indigo-600 hover:underline"
          >
            {showBrainstorm ? 'Skrýt AI asistenta' : 'AI asistent'}
          </button>
          <button
            onClick={() => setShowItemsLibrary((v) => !v)}
            className="text-sm text-indigo-600 hover:underline"
          >
            {showItemsLibrary ? 'Skrýt předměty' : 'Předměty'}
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
            selectedChoiceId={selectedChoiceId}
            onNodeSelect={(id) => { setSelectedNodeId(id); setSelectedChoiceId(null) }}
            onChoiceSelect={(id) => { setSelectedChoiceId(id); setSelectedNodeId(null) }}
            onNodePositionChange={handleNodePositionChange}
            onNewConnection={handleNewConnection}
            onDeleteChoice={handleDeleteChoice}
          />
        </div>

        {/* Right panel: node or choice detail */}
        {(selectedNode || selectedChoice) && (
          <div className="w-80 border-l bg-white shrink-0">
            {selectedNode && (
              <NodeDetailPanel
                key={selectedNode.id}
                node={selectedNode}
                allNodes={nodes}
                combatConfig={combatConfigs.find((c) => c.node_id === selectedNode.id) ?? null}
                onSave={handleSaveNode}
                onGenerateText={handleGenerateText}
                onClose={() => setSelectedNodeId(null)}
                onAddNode={handleAddNode}
                onSaveCombatConfig={handleSaveCombatConfig}
                isGenerating={isGenerating}
                streamingContent={streamingContent}
                assignedItems={nodeItems
                  .filter((ni) => ni.node_id === selectedNode.id)
                  .flatMap((ni) => {
                    const item = items.find((i) => i.id === ni.item_id)
                    return item ? [item] : []
                  })}
                allGamebookItems={items}
                onAssignItem={(itemId) => handleAssignItem(selectedNode.id, itemId)}
                onUnassignItem={(itemId) => handleUnassignItem(selectedNode.id, itemId)}
                onCreateItem={handleCreateItem}
                onUpdateItem={handleUpdateItem}
              />
            )}
            {selectedChoice && (
              <ChoiceDetailPanel
                key={selectedChoice.id}
                choice={selectedChoice}
                fromNode={nodes.find((n) => n.id === selectedChoice.from_node_id) ?? null}
                toNode={nodes.find((n) => n.id === selectedChoice.to_node_id) ?? null}
                onSave={handleSaveChoice}
                onDelete={handleDeleteChoice}
                onClose={() => setSelectedChoiceId(null)}
              />
            )}
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

      {showItemsLibrary && (
        <ItemsLibraryModal
          items={items}
          nodeItems={nodeItems}
          allNodes={nodes}
          onClose={() => setShowItemsLibrary(false)}
          onCreateItem={handleCreateItem}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
        />
      )}
    </div>
  )
}
