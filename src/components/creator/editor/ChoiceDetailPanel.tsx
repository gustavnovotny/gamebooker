'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Choice, Node } from '@/lib/supabase/types'
import { X, Trash2, Save, ArrowRight } from 'lucide-react'

interface ChoiceDetailPanelProps {
  choice: Choice
  fromNode: Node | null
  toNode: Node | null
  onSave: (choice: Choice) => void
  onDelete: (choiceId: string) => void
  onClose: () => void
}

export default function ChoiceDetailPanel({
  choice,
  fromNode,
  toNode,
  onSave,
  onDelete,
  onClose,
}: ChoiceDetailPanelProps) {
  const [text, setText] = useState(choice.text)

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Volba</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
        <span className="font-medium truncate">{fromNode?.title ?? '–'}</span>
        <ArrowRight className="w-3 h-3 shrink-0" />
        <span className="font-medium truncate">{toNode?.title ?? '–'}</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="choice-text">Text volby</Label>
        <Input
          id="choice-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Vydat se do lesa…"
          onKeyDown={(e) => e.key === 'Enter' && onSave({ ...choice, text })}
          autoFocus
        />
        <p className="text-xs text-slate-400">Text, který čtenář uvidí jako možnost volby.</p>
      </div>

      <Button onClick={() => onSave({ ...choice, text })} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Uložit volbu
      </Button>

      <Button
        variant="outline"
        className="w-full text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => onDelete(choice.id)}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Smazat volbu
      </Button>
    </div>
  )
}
