'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Plus, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Item, NodeItem, Node, StatAttribute } from '@/lib/supabase/types'

const STAT_ATTRIBUTES: { value: StatAttribute; label: string }[] = [
  { value: 'sila', label: 'Síla' },
  { value: 'inteligence', label: 'Inteligence' },
  { value: 'obratnost', label: 'Obratnost' },
  { value: 'stesti', label: 'Štěstí' },
]

interface ItemsLibraryModalProps {
  items: Item[]
  nodeItems: NodeItem[]
  allNodes: Node[]
  onClose: () => void
  onCreateItem: (item: Omit<Item, 'id' | 'gamebook_id'>) => Promise<Item>
  onUpdateItem: (item: Item) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
}

function ItemForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Uložit',
}: {
  initial: Partial<Item>
  onSave: (data: Omit<Item, 'id' | 'gamebook_id'>) => void
  onCancel: () => void
  saveLabel?: string
}) {
  const [name, setName] = useState(initial.name ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [attr, setAttr] = useState<StatAttribute | null>(initial.stat_bonus_attribute ?? null)
  const [bonusValue, setBonusValue] = useState(initial.stat_bonus_value ?? 0)

  return (
    <div className="space-y-3 p-3 bg-slate-50 rounded border">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Název *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zlatoňovský meč…" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Popis</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Popis předmětu…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bonus (atribut)</Label>
          <select
            value={attr ?? ''}
            onChange={(e) => setAttr((e.target.value as StatAttribute) || null)}
            className="w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— žádný —</option>
            {STAT_ATTRIBUTES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hodnota bonusu</Label>
          <Input type="number" min={0} value={bonusValue} onChange={(e) => setBonusValue(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => onSave({
            name: name.trim(),
            description: description.trim(),
            stat_bonus_attribute: attr,
            stat_bonus_value: bonusValue,
          })}
        >
          <Save className="w-3 h-3 mr-1" /> {saveLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>
    </div>
  )
}

export default function ItemsLibraryModal({
  items,
  nodeItems,
  allNodes,
  onClose,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}: ItemsLibraryModalProps) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function getAssignedNodeTitles(itemId: string): string[] {
    return nodeItems
      .filter((ni) => ni.item_id === itemId)
      .map((ni) => allNodes.find((n) => n.id === ni.node_id)?.title ?? '(neznámý uzel)')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">Předměty gamebooku</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Create new */}
          {!showCreateForm ? (
            <Button variant="outline" className="w-full" onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nový předmět
            </Button>
          ) : (
            <ItemForm
              initial={{}}
              saveLabel="Vytvořit předmět"
              onSave={async (data) => { await onCreateItem(data); setShowCreateForm(false) }}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {items.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-4">
              Zatím žádné předměty. Vytvořte první nebo vygenerujte osnovu.
            </p>
          )}

          {/* Item list */}
          {items.map((item) => {
            const assignedTitles = getAssignedNodeTitles(item.id)
            const isExpanded = expandedItemId === item.id
            const isConfirmingDelete = confirmDeleteId === item.id

            return (
              <div key={item.id} className="border rounded-lg overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white">
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {item.stat_bonus_attribute
                        ? `+${item.stat_bonus_value} ${STAT_ATTRIBUTES.find((a) => a.value === item.stat_bonus_attribute)?.label}`
                        : 'Bez bonusu'}
                      {assignedTitles.length > 0 && ` · ${assignedTitles.join(', ')}`}
                    </p>
                  </button>
                  <button onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>

                {/* Delete confirmation */}
                {isConfirmingDelete && (
                  <div className="px-3 py-2 bg-red-50 border-t border-red-100 flex items-center justify-between gap-2">
                    <p className="text-xs text-red-700">
                      {assignedTitles.length > 0
                        ? `Přiřazen na ${assignedTitles.length} uzl${assignedTitles.length === 1 ? 'u' : 'ech'}. Opravdu smazat?`
                        : 'Opravdu smazat předmět?'}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => { await onDeleteItem(item.id); setConfirmDeleteId(null) }}
                      >
                        Smazat
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>Zrušit</Button>
                    </div>
                  </div>
                )}

                {/* Expanded edit form */}
                {isExpanded && !isConfirmingDelete && (
                  <div className="px-3 pb-3 pt-1 border-t bg-slate-50">
                    <ItemForm
                      initial={item}
                      onSave={async (data) => { await onUpdateItem({ ...item, ...data }); setExpandedItemId(null) }}
                      onCancel={() => setExpandedItemId(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
