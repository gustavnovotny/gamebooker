# Item Discovery — Creator Tools Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let gamebook creators assign, create, edit, and remove items on `item_discovery` nodes, with a global items library modal accessible from the editor header.

**Architecture:** State for `items` and `nodeItems` lives in `GamebookEditor` (same pattern as `combatConfigs`). Page server component fetches both. Two new components — `ItemAssignmentPanel` (inline in NodeDetailPanel) and `ItemsLibraryModal` (header-triggered overlay) — receive data and callbacks as props. Outline generation is fixed to persist `suggested_items`.

**Tech Stack:** Next.js 15 App Router, Supabase client SDK, React hooks, TypeScript, Tailwind CSS

**Known duplication:** `STAT_ATTRIBUTES` constant is defined in both `ItemAssignmentPanel.tsx` and `ItemsLibraryModal.tsx`. This is intentional for now — extraction to a shared file can be done in a follow-up refactor.

**Spec:** `docs/superpowers/specs/2026-03-18-item-discovery-creator-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/tvorit/[id]/page.tsx` | Modify | Fetch `items` + `node_items`, pass to `GamebookEditor` |
| `src/components/creator/editor/GamebookEditor.tsx` | Modify | Add items/nodeItems state, CRUD handlers, assign/unassign handlers, `showItemsLibrary` toggle, outline generation fix |
| `src/components/creator/editor/NodeDetailPanel.tsx` | Modify | Accept item-related props, render `ItemAssignmentPanel` for `item_discovery` nodes |
| `src/components/creator/editor/ItemAssignmentPanel.tsx` | Create | Inline item assignment: list assigned items with edit/remove, picker for existing, inline create form |
| `src/components/creator/editor/ItemsLibraryModal.tsx` | Create | Modal with full gamebook item list, inline edit, delete, create |

---

## Task 1: Page-level data fetching

**Files:**
- Modify: `src/app/tvorit/[id]/page.tsx`

- [ ] **Step 1: Read the current file**

  Open `src/app/tvorit/[id]/page.tsx` and understand the existing two-phase fetch pattern (nodes first, then choices + combat_configs using nodeIds).

- [ ] **Step 2: Add items and node_items fetches**

  In the second `Promise.all`, add two new fetches. `items` is gamebook-scoped (no short-circuit needed). `node_items` uses the same nodeIds short-circuit as `combat_configs`.

  ```typescript
  const [
    { data: rawChoices },
    { data: rawCombatConfigs },
    { data: rawItems },
    { data: rawNodeItems },
  ] = await Promise.all([
    nodeIds.length > 0
      ? supabase.from('choices').select('*').in('from_node_id', nodeIds)
      : Promise.resolve({ data: [] }),
    nodeIds.length > 0
      ? supabase.from('combat_configs').select('*').in('node_id', nodeIds)
      : Promise.resolve({ data: [] }),
    supabase.from('items').select('*').eq('gamebook_id', id),
    nodeIds.length > 0
      ? supabase.from('node_items').select('*').in('node_id', nodeIds)
      : Promise.resolve({ data: [] }),
  ])

  const choices = (rawChoices as Choice[]) ?? []
  const combatConfigs = (rawCombatConfigs as CombatConfig[]) ?? []
  const items = (rawItems as Item[]) ?? []
  const nodeItems = (rawNodeItems as NodeItem[]) ?? []
  ```

  Also add `Item` and `NodeItem` to the existing named import at the top of the file (line 4):
  ```typescript
  import type { Gamebook, Node, Choice, Item, NodeItem } from '@/lib/supabase/types'
  ```
  Remove the existing inline `import('@/lib/supabase/types').CombatConfig` cast on the `combatConfigs` line and replace with a top-level import of `CombatConfig` the same way.

- [ ] **Step 3: Pass new props to GamebookEditor**

  Add `initialItems={items}` and `initialNodeItems={nodeItems}` to the `<GamebookEditor>` JSX call. The TypeScript compiler will show errors until Task 2 adds these props — that's expected.

- [ ] **Step 4: Verify build errors are only the expected missing props**

  ```bash
  npm run build 2>&1 | grep -E "error TS|initialItems|initialNodeItems"
  ```
  Expected: errors about unknown props `initialItems` / `initialNodeItems` on `GamebookEditor`. No other new errors.

---

## Task 2: GamebookEditor — state, handlers, outline fix

**Files:**
- Modify: `src/components/creator/editor/GamebookEditor.tsx`

- [ ] **Step 1: Add new props and state**

  Add to the `GamebookEditorProps` interface:
  ```typescript
  initialItems: Item[]
  initialNodeItems: NodeItem[]
  ```

  Add imports for `Item` and `NodeItem` from `@/lib/supabase/types`.

  Add state inside the component:
  ```typescript
  const [items, setItems] = useState<Item[]>(initialItems)
  const [nodeItems, setNodeItems] = useState<NodeItem[]>(initialNodeItems)
  const [showItemsLibrary, setShowItemsLibrary] = useState(false)
  ```

- [ ] **Step 2: Add handleCreateItem**

  ```typescript
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
  ```

- [ ] **Step 3: Add handleUpdateItem**

  ```typescript
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
  ```

- [ ] **Step 4: Add handleDeleteItem**

  ```typescript
  const handleDeleteItem = useCallback(async (itemId: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('items') as any).delete().eq('id', itemId)
    // node_items cascade automatically; update local state to match
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    setNodeItems((prev) => prev.filter((ni) => ni.item_id !== itemId))
  }, [supabase])
  ```

- [ ] **Step 5: Add handleAssignItem and handleUnassignItem**

  Use a `useRef` to hold the current `nodeItems` value for the duplicate guard. This avoids adding `nodeItems` to `handleAssignItem`'s `useCallback` dependency array, which would create a new function reference on every assignment and invalidate all child memoization.

  Add near the top of the component (after the state declarations):
  ```typescript
  const nodeItemsRef = useRef(nodeItems)
  useEffect(() => { nodeItemsRef.current = nodeItems }, [nodeItems])
  ```

  Add import `useRef` and `useEffect` to the React import at the top of `GamebookEditor.tsx` (they may already be there — check first).

  ```typescript
  const handleAssignItem = useCallback(async (
    nodeId: string, itemId: string
  ): Promise<void> => {
    // Guard: prevent duplicate (check ref to avoid stale closure without dep array churn)
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
  ```

- [ ] **Step 6: Fix handleOutlineGenerated to persist suggested_items**

  Inside `handleOutlineGenerated`, after `setChoices(...)` and before `setShowBrainstorm(false)`, add:

  ```typescript
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
  ```

- [ ] **Step 7: Add header button for items library**

  In the JSX, in the header's right flex row (next to the existing "AI asistent" button, before `PublishButton`), add:

  ```tsx
  <button
    onClick={() => setShowItemsLibrary((v) => !v)}
    className="text-sm text-indigo-600 hover:underline"
  >
    {showItemsLibrary ? 'Skrýt předměty' : 'Předměty'}
  </button>
  ```

- [ ] **Step 8: Verify build compiles cleanly**

  ```bash
  npm run build 2>&1 | grep "error TS"
  ```
  Expected: only errors about `items`/`nodeItems` props not yet passed to `NodeDetailPanel` and `ItemsLibraryModal` not yet imported. No logic errors.

- [ ] **Step 9: Commit page.tsx only**

  At this point `GamebookEditor.tsx` has known prop errors (item props not yet passed to `NodeDetailPanel`). Commit only the page file now; `GamebookEditor.tsx` will be committed in Task 4 after the wiring is complete.

  ```bash
  git add src/app/tvorit/\[id\]/page.tsx
  git commit -m "feat: fetch items and node_items in editor page"
  ```

---

## Task 3: Create ItemAssignmentPanel

**Files:**
- Create: `src/components/creator/editor/ItemAssignmentPanel.tsx`

This component renders inside `NodeDetailPanel` for `item_discovery` nodes. It shows currently assigned items with inline editing, a picker to assign existing items, and an inline form to create new ones.

- [ ] **Step 1: Create the file with types and skeleton**

  ```typescript
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
  ```

- [ ] **Step 2: Add inline item editing sub-component**

  Add `ItemEditForm` as an inner component (inside the same file):

  ```typescript
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
  ```

- [ ] **Step 3: Implement the main ItemAssignmentPanel component**

  ```typescript
  export default function ItemAssignmentPanel({
    nodeId,
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
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | grep "ItemAssignmentPanel"
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/creator/editor/ItemAssignmentPanel.tsx
  git commit -m "feat: add ItemAssignmentPanel for item_discovery nodes"
  ```

---

## Task 4: Wire ItemAssignmentPanel into NodeDetailPanel

**Files:**
- Modify: `src/components/creator/editor/NodeDetailPanel.tsx`

- [ ] **Step 1: Add new props to NodeDetailPanelProps**

  Add the following to the `NodeDetailPanelProps` interface:

  ```typescript
  assignedItems: Item[]
  allGamebookItems: Item[]
  onAssignItem: (itemId: string) => Promise<void>
  onUnassignItem: (itemId: string) => Promise<void>
  onCreateItem: (item: Omit<Item, 'id' | 'gamebook_id'>) => Promise<Item>
  onUpdateItem: (item: Item) => Promise<void>
  ```

  Add import: `import type { Node, NodeType, CombatConfig, Item } from '@/lib/supabase/types'`

  Add import: `import ItemAssignmentPanel from './ItemAssignmentPanel'`

- [ ] **Step 2: Add props to destructuring**

  Add to the destructured parameters:
  ```typescript
  assignedItems,
  allGamebookItems,
  onAssignItem,
  onUnassignItem,
  onCreateItem,
  onUpdateItem,
  ```

- [ ] **Step 3: Render ItemAssignmentPanel for item_discovery nodes**

  Below the existing `CombatConfigForm` block (after line ~146), add:

  ```tsx
  {node.type === 'item_discovery' && (
    <ItemAssignmentPanel
      nodeId={node.id}
      assignedItems={assignedItems}
      allGamebookItems={allGamebookItems}
      onAssignItem={onAssignItem}
      onUnassignItem={onUnassignItem}
      onCreateItem={onCreateItem}
      onUpdateItem={onUpdateItem}
    />
  )}
  ```

- [ ] **Step 4: Pass new props from GamebookEditor**

  In `GamebookEditor.tsx`, find the `<NodeDetailPanel>` JSX and add these props:

  ```tsx
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
  ```

- [ ] **Step 5: Verify build**

  ```bash
  npm run build 2>&1 | grep "error TS"
  ```
  Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

  This is the first clean commit for `GamebookEditor.tsx` (all prop errors are now resolved).

  ```bash
  git add src/components/creator/editor/NodeDetailPanel.tsx src/components/creator/editor/GamebookEditor.tsx
  git commit -m "feat: wire ItemAssignmentPanel into NodeDetailPanel and GamebookEditor"
  ```

---

## Task 5: Create ItemsLibraryModal

**Files:**
- Create: `src/components/creator/editor/ItemsLibraryModal.tsx`

- [ ] **Step 1: Create the file with interface and skeleton**

  ```typescript
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
  ```

- [ ] **Step 2: Implement ItemForm helper (reusable within the file)**

  ```typescript
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
          <Button className="flex-1" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), description: description.trim(), stat_bonus_attribute: attr, stat_bonus_value: bonusValue })}>
            <Save className="w-3 h-3 mr-1" /> {saveLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Implement the main ItemsLibraryModal component**

  ```typescript
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
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
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
                        <Button size="sm" variant="destructive" onClick={async () => { await onDeleteItem(item.id); setConfirmDeleteId(null) }}>
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
  ```

- [ ] **Step 4: Verify TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | grep "ItemsLibraryModal"
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/creator/editor/ItemsLibraryModal.tsx
  git commit -m "feat: add ItemsLibraryModal for global item management"
  ```

---

## Task 6: Wire ItemsLibraryModal into GamebookEditor

**Files:**
- Modify: `src/components/creator/editor/GamebookEditor.tsx`

- [ ] **Step 1: Import ItemsLibraryModal**

  Add to imports:
  ```typescript
  import ItemsLibraryModal from './ItemsLibraryModal'
  ```

- [ ] **Step 2: Render modal conditionally**

  Inside the `return (...)` JSX, add the modal as a **sibling** to the `{showBrainstorm && ...}` block — NOT nested inside it. Place it after the brainstorm panel block, still inside the outermost `<div className="h-screen flex flex-col">`:

  ```tsx
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
  ```

- [ ] **Step 3: Full build check**

  ```bash
  npm run build 2>&1
  ```
  Expected: build succeeds with no TypeScript errors. Any lint warnings are acceptable.

- [ ] **Step 4: Run tests**

  ```bash
  npm test -- --passWithNoTests
  ```
  Expected: all existing tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/creator/editor/GamebookEditor.tsx
  git commit -m "feat: wire ItemsLibraryModal into editor header"
  ```

---

## Task 7: End-to-end smoke test + push

- [ ] **Step 1: Start dev server and manual test**

  ```bash
  npm run dev
  ```

  Test the following scenarios:
  1. Open a gamebook editor — header shows "Předměty" button
  2. Click "Předměty" → modal opens, shows empty state message
  3. Create a new item in the modal (name + stat bonus) → appears in list
  4. Edit the item in the modal → changes saved
  5. Delete the item → confirmation shown, item removed
  6. Click an `item_discovery` node → panel shows "Předměty uzlu" section
  7. Assign an existing item to the node → item appears with amber background
  8. Edit the item inline → changes saved and reflected in library
  9. Remove item from node → item disappears from node panel, still in library
  10. Create new item directly from node panel (picker → "Vytvořit nový") → created and auto-assigned
  11. Generate outline with AI → after generation, "Předměty" library shows the AI-suggested items

- [ ] **Step 2: Push to origin**

  ```bash
  git push origin master
  ```
