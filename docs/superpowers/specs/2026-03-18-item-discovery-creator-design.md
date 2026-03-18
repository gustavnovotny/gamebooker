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
Fetch `items` and `node_items` in the existing `Promise.all` alongside `combat_configs`.

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
  onAssignItem: (itemId: string) => void
  onUnassignItem: (itemId: string) => void
  onCreateItem: (item: Omit<Item, 'id' | 'gamebook_id'>) => Promise<Item>
  onUpdateItem: (item: Item) => void
}
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
interface ItemsLibraryModalProps {
  items: Item[]
  nodeItems: NodeItem[]
  allNodes: Node[]
  onClose: () => void
  onCreateItem: (item: Omit<Item, 'id' | 'gamebook_id'>) => Promise<Item>
  onUpdateItem: (item: Item) => void
  onDeleteItem: (itemId: string) => void
}
```

### 3. `GamebookEditor` changes

- Add `items`, `nodeItems` state and `initialItems`, `initialNodeItems` props.
- Add handlers: `handleCreateItem`, `handleUpdateItem`, `handleDeleteItem`, `handleAssignItem`, `handleUnassignItem`.
- Add `showItemsLibrary` boolean state, toggle from header button "Předměty".
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

handleUpdateItem(item: Item): void
// UPDATE items, setItems(prev => prev.map(...))

handleDeleteItem(itemId: string): void
// DELETE from items (cascades node_items), setItems + setNodeItems filtered

handleAssignItem(nodeId: string, itemId: string): void
// INSERT into node_items, setNodeItems(prev => [...prev, { node_id, item_id }])

handleUnassignItem(nodeId: string, itemId: string): void
// DELETE from node_items WHERE node_id AND item_id, setNodeItems filtered
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
  if (insertedItems) setItems(insertedItems as Item[])
}
```

Items are NOT auto-assigned to nodes — the creator decides which item goes on which node.

---

## Out of Scope

- Conditional choices (`condition_item_id`) UI — separate feature.
- Reader-side inventory and item_discovery handling — Plan 3.
- Gamebook validation for item_discovery nodes (e.g., requiring an assigned item before publish) — Plan 3.
