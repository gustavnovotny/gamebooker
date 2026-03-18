# Item Discovery — Creator Tools Design

**Date:** 2026-03-18
**Scope:** Creator-side item management for `item_discovery` nodes in the gamebook editor.

---

## Problem

`item_discovery` nodes exist in the type system and database schema but have no creator UI. The `items` and `node_items` tables are defined but unused. AI-generated `suggested_items` from outline generation are discarded. Creators have no way to assign items to nodes or manage the gamebook's item catalogue.

---

## Goals

1. Persist AI-suggested items when an outline is generated.
2. Let creators assign, create, edit, and remove items on `item_discovery` nodes (inline panel).
3. Provide a global items library modal for full item management across the gamebook.

---

## Data Model

**Existing tables (no schema changes needed):**

```sql
items (id, gamebook_id, name, description, stat_bonus_attribute, stat_bonus_value)
node_items (node_id, item_id)  -- many-to-many
```

One item can be assigned to multiple nodes. One node can have multiple items.

---

## State Management

**Pattern:** Same as `combatConfigs` — state lives in `GamebookEditor`, passed down as props.

**New state in `GamebookEditor`:**
```typescript
const [items, setItems] = useState<Item[]>(initialItems)
const [nodeItems, setNodeItems] = useState<NodeItem[]>(initialNodeItems)
```

**Page-level loading (`src/app/tvorit/[id]/page.tsx`):**
Add to the existing `Promise.all` alongside `combat_configs`:
```typescript
nodeIds.length > 0
  ? supabase.from('items').select('*').eq('gamebook_id', id)
  : supabase.from('items').select('*').eq('gamebook_id', id),  // items are gamebook-scoped, not node-scoped
nodeIds.length > 0
  ? supabase.from('node_items').select('*').in('node_id', nodeIds)
  : Promise.resolve({ data: [] }),
```
Note: `items` query uses `gamebook_id`, not `node_id`, so no short-circuit is needed. `node_items` uses `.in('node_id', nodeIds)` same as `combat_configs`.

---

## Component Architecture

### 1. `ItemAssignmentPanel` (new)

**Location:** `src/components/creator/editor/ItemAssignmentPanel.tsx`

Shown inside `NodeDetailPanel` when `node.type === 'item_discovery'`, below the "Uložit uzel" button (same position as `CombatConfigForm` for combat nodes).

**Features:**
- Lists items currently assigned to this node with inline edit form per item (name, description, stat_bonus_attribute dropdown, stat_bonus_value number input) and an "Odebrat" button.
- "**+ Přiřadit předmět**" button → expands a picker: dropdown of gamebook items not yet assigned to this node, with a "Vytvořit nový předmět" option at the bottom.
- Selecting an existing item from the picker assigns it immediately.
- Selecting "Vytvořit nový předmět" shows an inline creation form (name, description, stat_bonus_attribute, stat_bonus_value); on save the item is created and assigned to this node.

**Props:**
```typescript
interface ItemAssignmentPanelProps {
  nodeId: string
  assignedItems: Item[]           // items currently on this node
  allGamebookItems: Item[]        // all items in the gamebook (for picker)
  onAssignItem: (itemId: string) => Promise<void>
  onUnassignItem: (itemId: string) => Promise<void>
  onCreateItem: (item: Omit<Item, 'id' | 'gamebook_id'>) => Promise<Item>
  onUpdateItem: (item: Item) => Promise<void>
}
```

**Create-then-assign flow:** When the creator creates a new item via the inline form, `ItemAssignmentPanel` calls `onCreateItem(...)`, waits for the returned `Item`, then immediately calls `onAssignItem(newItem.id)`. The `onCreateItem` callback does NOT auto-assign — that is the panel's responsibility.
```

### 2. `ItemsLibraryModal` (new)

**Location:** `src/components/creator/editor/ItemsLibraryModal.tsx`

A fixed-position modal overlay (max-width 600px, centered) opened from the editor header.

**Features:**
- Header: "Předměty gamebooku" title + close (×) button.
- "**+ Nový předmět**" button creates an inline form at top of the list.
- Each item row: name, description, stat bonus badge, list of assigned node titles.
- Clicking a row expands an inline edit form (same fields as above).
- Delete button per item. If item is assigned to any nodes, shows a confirmation: "Předmět je přiřazen na N uzlech. Opravdu smazat?"

**Props:**
```typescript
// Node and Item types from '@/lib/supabase/types'
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

**Node title lookup:** For each item, find assigned node titles by filtering `nodeItems` where `item_id === item.id`, then mapping each `node_id` to the corresponding node title from `allNodes`.

### 3. `GamebookEditor` changes

- Add `items`, `nodeItems` state and `initialItems`, `initialNodeItems` props.
- Add handlers: `handleCreateItem`, `handleUpdateItem`, `handleDeleteItem`, `handleAssignItem`, `handleUnassignItem`.
- Add `showItemsLibrary` boolean state, toggle from header button "Předměty" placed between "AI asistent" button and `PublishButton`.
- Pass correct props to `NodeDetailPanel` and render `ItemsLibraryModal` when `showItemsLibrary === true`.
- In `handleOutlineGenerated`: after inserting nodes and choices, insert `suggested_items` into the `items` table and update `items` state.

### 4. `NodeDetailPanel` changes

- Accept new props: `assignedItems`, `allGamebookItems`, `onAssignItem`, `onUnassignItem`, `onCreateItem`, `onUpdateItem`.
- Render `<ItemAssignmentPanel>` when `node.type === 'item_discovery'`.

### 5. Page (`src/app/tvorit/[id]/page.tsx`) changes

- Fetch `items` (all for gamebook) and `node_items` (for current node IDs) in `Promise.all`.
- Pass `initialItems` and `initialNodeItems` to `GamebookEditor`.

---

## Handlers (GamebookEditor)

```typescript
handleCreateItem(item: Omit<Item, 'id' | 'gamebook_id'>): Promise<Item>
// INSERT into items, setItems(prev => [...prev, newItem]), return newItem

handleUpdateItem(item: Item): Promise<void>
// UPDATE items SET name, description, stat_bonus_attribute, stat_bonus_value WHERE id
// setItems(prev => prev.map(i => i.id === item.id ? item : i))

handleDeleteItem(itemId: string): Promise<void>
// DELETE FROM items WHERE id = itemId
// node_items rows cascade automatically (FK: item_id references items(id) ON DELETE CASCADE — confirmed in migration)
// setItems(prev => prev.filter(i => i.id !== itemId))
// setNodeItems(prev => prev.filter(ni => ni.item_id !== itemId))

handleAssignItem(nodeId: string, itemId: string): Promise<void>
// Guard: if nodeItems already contains { node_id: nodeId, item_id: itemId }, return early (no-op)
// INSERT INTO node_items (node_id, item_id) VALUES (nodeId, itemId)
// setNodeItems(prev => [...prev, { node_id: nodeId, item_id: itemId }])

handleUnassignItem(nodeId: string, itemId: string): Promise<void>
// DELETE FROM node_items WHERE node_id = nodeId AND item_id = itemId
// setNodeItems(prev => prev.filter(ni => !(ni.node_id === nodeId && ni.item_id === itemId)))
```

**Partial application for panel:** `NodeDetailPanel` receives single-argument callbacks. `GamebookEditor` passes closures:
```typescript
onAssignItem={(itemId) => handleAssignItem(selectedNode.id, itemId)}
onUnassignItem={(itemId) => handleUnassignItem(selectedNode.id, itemId)}
```

---

## outline Generation Change

In `handleOutlineGenerated`, after inserting nodes + choices:
```typescript
if (outline.suggested_items?.length) {
  const itemInserts = outline.suggested_items.map(item => ({
    gamebook_id: gamebook.id,
    name: item.name,
    description: item.description ?? '',
    stat_bonus_attribute: item.stat_bonus_attribute,
    stat_bonus_value: item.stat_bonus_value ?? 0,
  }))
  const { data: insertedItems } = await supabase.from('items').insert(itemInserts).select()
  if (insertedItems) setItems(prev => [...prev, ...(insertedItems as Item[])])
}
```

Items are NOT auto-assigned to nodes.
```

Items are NOT auto-assigned to nodes — the creator decides which item goes on which node.

---

---

## Out of Scope

- Conditional choices (`condition_item_id`) UI — separate feature.
- Reader-side inventory and item_discovery handling — Plan 3.
- Gamebook validation for item_discovery nodes (e.g., requiring an assigned item before publish) — Plan 3.
