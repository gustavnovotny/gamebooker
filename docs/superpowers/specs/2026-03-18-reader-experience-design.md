# Reader Experience — Design Spec

**Date:** 2026-03-18
**Scope:** Plan 3 — Reader-side gameplay for `/hrat/[id]`, including character creation, node navigation, inventory, and combat.

---

## Problem

The reader-facing routes (`/hrat/[id]`) are stubs. Players cannot start, play, or complete a gamebook. No character state, navigation, inventory, or combat UI exists.

---

## Goals

1. Character creation with stat allocation at game start.
2. Node-by-node navigation with URL per node.
3. Item discovery with automatic inventory pickup and toast notification.
4. Turn-based combat with persistent HP across encounters.
5. Ending screen with restart option.
6. All state stored in localStorage — no backend session persistence.

---

## Out of Scope

- Creator-defined starting stats per gamebook (hardcoded defaults for now).
- Conditional choices (`condition_item_id`) — Plan 4.
- Reader accounts, cloud saves, or progress syncing.
- Gamebook validation before play (assumes published gamebook is valid).

---

## Session State

Stored in localStorage under key `gamebooker_session_<gamebookId>`.

```typescript
interface GameSession {
  gamebookId: string
  currentNodeId: string
  hp: number          // current HP
  maxHp: number       // always 20
  stats: {
    sila: number
    inteligence: number
    obratnost: number
    stesti: number
  }
  inventory: Item[]   // full Item objects (avoids fetch at inventory display)
}
```

**Hardcoded defaults:**
- `maxHp`: 20, `hp`: 20
- Each stat starts at 5
- Player has 5 bonus points to distribute freely (min 5 per stat, no upper cap beyond pool exhaustion)

**Session lifecycle:**
- `/hrat/[id]` checks localStorage on load; if session exists, redirects to `currentNodeId`
- Character creation writes initial session and redirects to the start node
- Each node page updates `currentNodeId` on arrival
- "Hrát znovu" deletes the session key and redirects to `/hrat/[id]`

---

## Architecture: Option A — Server-rendered per route

Each node page is a Next.js server component that fetches only the current node's data. A client component handles session reads/writes. This matches the existing pattern in `/tvorit/[id]/page.tsx`.

---

## Routes & Pages

### `/hrat/[id]/page.tsx` (server component)
- Fetches gamebook `title` and `description`.
- Passes to `<GameStartClient>` (client component):
  - If session exists in localStorage → `router.replace(/hrat/[id]/uzel/<currentNodeId>)`
  - If no session → renders `<CharacterCreation>`

### `/hrat/[id]/uzel/[nodeId]/page.tsx` (server component)
Fetches in parallel:
- `node` — the current node record
- `choices` — where `from_node_id = nodeId`
- `combat_config` — if `node.type === 'combat'`
- `node_items` + `items` — if `node.type === 'item_discovery'`

Passes all fetched data to `<NodeReader>` client component.

---

## Component Architecture

### `<NodeReader>` (client)
Root client component. Reads and writes the localStorage session. Renders one child based on `node.type`:
- `<StoryNodeView>` — for `story` nodes
- `<ItemDiscoveryNodeView>` — for `item_discovery` nodes
- `<CombatView>` — for `combat` nodes
- `<EndingView>` — for `ending` nodes

Also renders `<SessionBar>` (persistent HP + inventory button).

### `<SessionBar>` (client)
Fixed top bar. Shows:
- Current HP / max HP
- Inventory button (opens `<InventoryModal>`)

### `<StoryNodeView>` (client)
- Displays node `title` and `content`
- Lists choices as buttons; clicking navigates to `router.push(/hrat/[id]/uzel/<toNodeId>)`
- Updates `session.currentNodeId` on arrival

### `<ItemDiscoveryNodeView>` (client)
On mount:
1. Reads `session.inventory`
2. Filters `assignedItems` to those not already in inventory (by `id`)
3. Adds new items to `session.inventory`, writes to localStorage
4. Shows one toast per new item: *"Získal jsi: [item name]"* (CSS-only, no extra library)

Then renders node text and choices identically to `<StoryNodeView>`.

### `<CombatView>` (client)
See Combat section below.

### `<EndingView>` (client)
- Displays node `title` and `content`
- "Hrát znovu" button: deletes localStorage session, `router.push(/hrat/[id])`

### `<InventoryModal>` (client)
Opened from `<SessionBar>`. Lists all items in `session.inventory`:
- Item name, description, stat bonus badge (e.g. "+2 Síla")
- Read-only — no dropping items
- Close button

---

## Combat System

Based on `docs/souboje.md`.

### Local state (inside `<CombatView>`, not persisted to localStorage during combat)

```typescript
{
  playerHp: number        // initialized from session.hp
  enemyHp: number         // from combat_config.enemy_hp
  round: number           // starts at 1
  log: string[]           // human-readable combat log
  phase: 'idle' | 'rolling' | 'result' | 'victory' | 'defeat'
  luckUsed: boolean       // once per combat
}
```

### Combat flow

1. Player clicks "Hodit kostky" → both sides roll 1d6 + relevant stat
2. Winner deals `max(1, winnerRoll - loserRoll)` HP damage
3. Log entry appended, round increments
4. Repeat for up to 3 rounds (or until a side reaches 0 HP)
5. After 3 rounds: side with more HP wins
6. **Victory:** write `session.hp = playerHp` to localStorage, navigate to `victory_node_id`
7. **Defeat:** write `session.hp = playerHp` (may be 0 or low), navigate to `defeat_node_id`

HP is NOT restored between combats. Damage carries over.

### Štěstí mechanic

"Zkusit štěstí" button — available once per combat (`luckUsed === false`):
- Roll 1d6; if result ≤ `session.stats.stesti`, player gets +3 on next attack roll
- Sets `luckUsed = true` regardless of outcome

### Enemy stats

Read from `combat_config`:
- `enemy_name`, `enemy_hp`, `enemy_attack_attribute`, `enemy_attack_bonus`
- `player_attack_attribute` — which player stat is used for attack rolls
- `victory_node_id`, `defeat_node_id`

---

## File Structure

**New files:**
- `src/app/hrat/[id]/page.tsx` — replace stub; server component
- `src/app/hrat/[id]/uzel/[nodeId]/page.tsx` — server component
- `src/components/reader/GameStartClient.tsx` — session check + redirect
- `src/components/reader/CharacterCreation.tsx` — stat allocation UI
- `src/components/reader/NodeReader.tsx` — root client wrapper
- `src/components/reader/SessionBar.tsx` — HP bar + inventory button
- `src/components/reader/StoryNodeView.tsx` — story + choices
- `src/components/reader/ItemDiscoveryNodeView.tsx` — item pickup + toast + choices
- `src/components/reader/CombatView.tsx` — full combat screen
- `src/components/reader/EndingView.tsx` — ending + restart
- `src/components/reader/InventoryModal.tsx` — inventory display
- `src/lib/reader/session.ts` — localStorage read/write helpers + `GameSession` type

**Modified files:**
- `src/app/hrat/[id]/page.tsx` — replace placeholder stub

---

## Testing

- `CharacterCreation` — renders stat inputs, pool counter decrements, submit disabled when pool > 0
- `StoryNodeView` — renders title, content, choice buttons
- `ItemDiscoveryNodeView` — adds new items to session inventory on mount, skips already-owned items
- `CombatView` — round resolution logic, luck mechanic, victory/defeat routing
- `session.ts` — read/write/clear helpers

---

## Czech UI Strings

| Element | Text |
|---|---|
| Start button | Začít hrát |
| Points remaining | Zbývá bodů: N |
| Pick up item toast | Získal jsi: [name] |
| Roll dice button | Hodit kostky |
| Try luck button | Zkusit štěstí |
| Restart button | Hrát znovu |
| Inventory button label | Inventář |
| HP label | Zdraví |
