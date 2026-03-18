'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Node } from '@/lib/supabase/types'
import { Sparkles, Save, X } from 'lucide-react'

interface NodeDetailPanelProps {
  node: Node
  onSave: (node: Node) => void
  onGenerateText: (nodeId: string) => void
  onClose: () => void
  isGenerating?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  story: 'Příběh',
  combat: 'Souboj',
  item_discovery: 'Předmět',
  ending: 'Konec',
}

export default function NodeDetailPanel({
  node,
  onSave,
  onGenerateText,
  onClose,
  isGenerating = false,
}: NodeDetailPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [content, setContent] = useState(node.content)

  // Sync content when AI generates text (streaming updates node.content in parent)
  useEffect(() => {
    setContent(node.content)
  }, [node.content])

  function handleSave() {
    onSave({ ...node, title, content })
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

      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="node-content">Text příběhu</Label>
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
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-48 p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Text příběhu pro čtenáře…"
        />
      </div>

      <Button onClick={handleSave} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Uložit uzel
      </Button>
    </div>
  )
}
