'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus, X, Save } from 'lucide-react'
import type { Item, StatAttribute } from '@/lib/supabase/types'

const STAT_ATTRIBUTES: { value: StatAttribute; label: string }[] = [
  { value: 'sila', label: 'Síla' },
  { value: 'inteligence', label: 'Inteligence' },
  { value: 'obratnost', label: 'Obratnost' },
  { value: 'stesti', label: 'Štěstí' },
]

interface ItemAssignmentPanelProps {
  nodeId: string
  assignedItems: Item[]
  allGamebookItems: Item[]
  onAssignItem: (itemId: string) => Promise<void>
  onUnassignItem: (itemId: string) => Promise<void>
  onCreateItem: (item: Omit<Item, 'id' | 'gamebook_id'>) => Promise<Item>
  onUpdateItem: (item: Item) => Promise<void>
}

function ItemEditForm({
  item,
  onSave,
  onCancel,
}: {
  item: Item
  onSave: (updated: Item) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description)
  const [attr, setAttr] = useState<StatAttribute | null>(item.stat_bonus_attribute)
  const [bonusValue, setBonusValue] = useState(item.stat_bonus_value)

  return (
    <div className="space-y-2 p-2 bg-slate-50 rounded border">
      <div className="space-y-1">
        <Label className="text-xs">Název</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Popis</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
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
          <Input
            type="number"
            min={0}
            value={bonusValue}
            onChange={(e) => setBonusValue(Number(e.target.value))}
            className="text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onSave({ ...item, name, description, stat_bonus_attribute: attr, stat_bonus_value: bonusValue })}
        >
          <Save className="w-3 h-3 mr-1" /> Uložit
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

export default function ItemAssignmentPanel({
  nodeId: _nodeId,
  assignedItems,
  allGamebookItems,
  onAssignItem,
  onUnassignItem,
  onCreateItem,
  onUpdateItem,
}: ItemAssignmentPanelProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAttr, setNewAttr] = useState<StatAttribute | null>(null)
  const [newBonusValue, setNewBonusValue] = useState(0)

  const assignedIds = new Set(assignedItems.map((i) => i.id))
  const availableToAssign = allGamebookItems.filter((i) => !assignedIds.has(i.id))

  async function handleCreate() {
    if (!newName.trim()) return
    const created = await onCreateItem({
      name: newName.trim(),
      description: newDescription.trim(),
      stat_bonus_attribute: newAttr,
      stat_bonus_value: newBonusValue,
    })
    await onAssignItem(created.id)
    setNewName('')
    setNewDescription('')
    setNewAttr(null)
    setNewBonusValue(0)
    setShowCreateForm(false)
    setShowPicker(false)
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Předměty uzlu</p>

      {assignedItems.length === 0 && (
        <p className="text-xs text-slate-400 italic">Žádné předměty přiřazeny.</p>
      )}

      {assignedItems.map((item) => (
        <div key={item.id} className="space-y-1">
          {editingItemId === item.id ? (
            <ItemEditForm
              item={item}
              onSave={async (updated) => { await onUpdateItem(updated); setEditingItemId(null) }}
              onCancel={() => setEditingItemId(null)}
            />
          ) : (
            <div className="flex items-center justify-between gap-2 p-2 rounded border bg-amber-50 border-amber-200">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                {item.stat_bonus_attribute && (
                  <p className="text-xs text-slate-500">
                    +{item.stat_bonus_value} {STAT_ATTRIBUTES.find((a) => a.value === item.stat_bonus_attribute)?.label}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditingItemId(item.id)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => onUnassignItem(item.id)}>
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {!showPicker ? (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowPicker(true)}>
          <Plus className="w-3 h-3 mr-1" /> Přiřadit předmět
        </Button>
      ) : (
        <div className="space-y-2 p-2 border rounded bg-slate-50">
          {availableToAssign.length > 0 && (
            <select
              defaultValue=""
              onChange={async (e) => {
                if (e.target.value) {
                  await onAssignItem(e.target.value)
                  setShowPicker(false)
                }
              }}
              className="w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— vybrat existující —</option>
              {availableToAssign.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          )}

          {!showCreateForm ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-indigo-600"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Vytvořit nový předmět
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Název *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="text-sm" placeholder="Zlatoňovský meč…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Popis</Label>
                <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="text-sm" placeholder="Popis předmětu…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Bonus (atribut)</Label>
                  <select
                    value={newAttr ?? ''}
                    onChange={(e) => setNewAttr((e.target.value as StatAttribute) || null)}
                    className="w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none"
                  >
                    <option value="">— žádný —</option>
                    {STAT_ATTRIBUTES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hodnota</Label>
                  <Input type="number" min={0} value={newBonusValue} onChange={(e) => setNewBonusValue(Number(e.target.value))} className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={!newName.trim()} onClick={handleCreate}>
                  Vytvořit a přiřadit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowCreateForm(false); setShowPicker(false) }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {!showCreateForm && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowPicker(false)}>
              Zrušit
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
