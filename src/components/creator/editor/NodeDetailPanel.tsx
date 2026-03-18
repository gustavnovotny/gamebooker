'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Node, NodeType, CombatConfig } from '@/lib/supabase/types'
import { Sparkles, Save, X, Plus } from 'lucide-react'
import CombatConfigForm from './CombatConfigForm'

interface NodeDetailPanelProps {
  node: Node
  allNodes: Node[]
  combatConfig: CombatConfig | null
  onSave: (node: Node) => void
  onGenerateText: (nodeId: string) => void
  onClose: () => void
  onAddNode: (fromNodeId: string, type: NodeType, title: string, choiceText: string) => void
  onSaveCombatConfig: (config: Omit<CombatConfig, 'id'> & { id?: string }) => void
  isGenerating?: boolean
  streamingContent?: string | null
}

const TYPE_LABELS: Record<NodeType, string> = {
  story: 'Příběh',
  combat: 'Souboj',
  item_discovery: 'Předmět',
  ending: 'Konec',
}

const TYPE_COLORS: Record<NodeType, string> = {
  story: 'bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200',
  combat: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
  item_discovery: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
  ending: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
}

const NODE_TYPES: NodeType[] = ['story', 'combat', 'item_discovery', 'ending']

export default function NodeDetailPanel({
  node,
  allNodes,
  combatConfig,
  onSave,
  onGenerateText,
  onClose,
  onAddNode,
  onSaveCombatConfig,
  isGenerating = false,
  streamingContent = null,
}: NodeDetailPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [summary, setSummary] = useState(node.summary)
  const [content, setContent] = useState(node.content)
  const [newNodeType, setNewNodeType] = useState<NodeType>('story')
  const [newNodeTitle, setNewNodeTitle] = useState('')
  const [choiceText, setChoiceText] = useState('')
  const [addingNode, setAddingNode] = useState(false)

  // Sync content when node is saved externally (e.g. after streaming completes)
  useEffect(() => {
    if (streamingContent === null) setContent(node.content)
  }, [node.content, streamingContent])

  function handleSave() {
    onSave({ ...node, title, summary, content })
  }

  async function handleAddNode() {
    if (!newNodeTitle.trim() || !choiceText.trim()) return
    setAddingNode(true)
    await onAddNode(node.id, newNodeType, newNodeTitle.trim(), choiceText.trim())
    setNewNodeTitle('')
    setChoiceText('')
    setAddingNode(false)
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{TYPE_LABELS[node.type]}</Badge>
          {node.is_start && <Badge variant="default">Začátek</Badge>}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="node-title">Název uzlu</Label>
        <Input
          id="node-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="node-summary">Osnova</Label>
        <textarea
          id="node-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full h-20 p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Co se v tomto uzlu děje — v bodech nebo větách. Řídí generování AI textu."
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="node-content">Vygenerovaný text</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGenerateText(node.id)}
            disabled={isGenerating}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {isGenerating ? 'Generuji…' : 'Generovat AI'}
          </Button>
        </div>
        <textarea
          id="node-content"
          value={streamingContent ?? content}
          onChange={(e) => { if (!streamingContent) setContent(e.target.value) }}
          className="w-full h-28 p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          placeholder="Text se vygeneruje z osnovy…"
          readOnly={streamingContent !== null}
        />
      </div>

      <Button onClick={handleSave} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Uložit uzel
      </Button>

      {node.type === 'combat' && (
        <CombatConfigForm
          nodeId={node.id}
          config={combatConfig}
          allNodes={allNodes}
          onSave={onSaveCombatConfig}
        />
      )}

      {node.type !== 'ending' && (
        <>
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Přidat navazující uzel</p>

            <div className="grid grid-cols-2 gap-1">
              {NODE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setNewNodeType(type)}
                  className={`text-xs px-2 py-1.5 rounded border font-medium transition-colors ${TYPE_COLORS[type]} ${newNodeType === type ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="new-node-title" className="text-xs">Název nového uzlu</Label>
              <Input
                id="new-node-title"
                value={newNodeTitle}
                onChange={(e) => setNewNodeTitle(e.target.value)}
                placeholder="Příjezd do vesnice…"
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="choice-text" className="text-xs">Text volby (co čtenář uvidí)</Label>
              <Input
                id="choice-text"
                value={choiceText}
                onChange={(e) => setChoiceText(e.target.value)}
                placeholder="Vydat se do lesa…"
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNode()}
              />
            </div>

            <Button
              onClick={handleAddNode}
              disabled={!newNodeTitle.trim() || !choiceText.trim() || addingNode}
              variant="outline"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addingNode ? 'Přidávám…' : 'Přidat uzel'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
