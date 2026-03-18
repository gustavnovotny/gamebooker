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
  maxHp: number       // sila + 10, computed at character creation
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
- Each stat starts at 5
- Player has 5 bonus points to distribute freely across the 4 stats (min 5 per stat, no upper cap beyond pool exhaustion)
- `maxHp = sila + 10` — computed after stat allocation (default sila=5 → maxHp=15; if player puts all 5 bonus points into sila → maxHp=20)
- `hp = maxHp` at game start

**Submit gate:** "Začít hrát" button is enabled only when the bonus point pool reaches exactly 0 (all 5 bonus points distributed).

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
- Fetches start node: `SELECT id FROM nodes WHERE gamebook_id = id AND is_start = true LIMIT 1`.
- Passes `startNodeId: string | null` to `<GameStartClient>` (client component):
  - If session exists in localStorage → `router.replace(/hrat/[id]/uzel/<currentNodeId>)`
  - If no session and `startNodeId` is non-null → renders `<CharacterCreation startNodeId={startNodeId} />`
  - If `startNodeId` is null → renders error (see Error Handling table)

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
  playerHp: number          // initialized from session.hp
  enemyHp: number           // from combat_config.enemy_hp
  playerRoundWins: number   // 0–2
  enemyRoundWins: number    // 0–2
  round: number             // 1–3
  log: string[]             // human-readable combat log
  phase: 'idle' | 'rolling' | 'result' | 'victory' | 'defeat'
  luckUsed: boolean         // once per combat
}
```

### Combat flow

Win condition: **best of 3 rounds** — first side to win 2 rounds wins the combat. Early exit if either side reaches 0 HP.

**Per round:**
1. Player clicks "Hodit kostky"
2. Both sides roll 1d6 + their combat attribute (`player_attribute` for player, `enemy_attribute` for enemy)
3. Player roll also adds item bonuses: sum of `stat_bonus_value` for all inventory items where `stat_bonus_attribute === combat_config.player_attribute`
4. Higher total wins the round; loser takes `max(1, winnerRoll − loserRoll)` HP damage. On exact tie: no HP lost, round not counted toward win totals (neither side earns a round win — round effectively replayed next turn)
5. Round win counter incremented for the winner; log entry added
6. If either side reaches 0 HP → combat ends immediately
7. If a side reaches 2 round wins → combat ends

**Resolution:**
- **Victory** (player wins 2 rounds, or enemy HP = 0): write `session.hp = playerHp` to localStorage, navigate to `victory_node_id`
- **Defeat** (enemy wins 2 rounds, or player HP = 0): write `session.hp = playerHp`, navigate to `defeat_node_id`

If `victory_node_id` or `defeat_node_id` is `null` (misconfigured gamebook), show an error message: *"Souboj není správně nakonfigurován."* and do not navigate.

HP is NOT restored between combats. Damage carries over.

### Štěstí mechanic

"Zkusit štěstí" button — available once per combat (`luckUsed === false`), usable only after losing a round:
- Roll 1d6 + `session.stats.stesti` + sum of inventory item bonuses where `stat_bonus_attribute === 'stesti'`
- If result ≥ 7: the lost round becomes a draw (no HP lost for either side)
- If result < 7: nothing changes
- Sets `luckUsed = true` regardless of outcome
- `luckUsed` is component-local state and resets automatically when `<CombatView>` remounts (i.e. each new combat node visit). It is intentionally NOT stored in the session.

### Enemy stats

Read from `combat_config`:
- `enemy_name`, `enemy_hp`, `enemy_sila`, `enemy_inteligence`, `enemy_obratnost`, `enemy_stesti`
- `player_attribute` (type `CombatAttribute = 'sila' | 'inteligence' | 'obratnost'`) — which player stat is used for attack rolls
- `enemy_attribute` — which enemy stat is used for attack rolls
- `victory_node_id: string | null`, `defeat_node_id: string | null`

Enemy stat used per round = `combat_config[`enemy_${combat_config.enemy_attribute}`]`.

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

**Modified files:** *(none beyond the new files above — `src/app/hrat/[id]/page.tsx` is listed above as a new file replacing the stub)*

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Gamebook has no `is_start = true` node | `<CharacterCreation>` shows error: *"Tento gamebook nemá startovní uzel."* — no start button |
| `[nodeId]` in URL does not exist | Server component returns 404 via Next.js `notFound()` |
| `victory_node_id` or `defeat_node_id` is `null` | `<CombatView>` shows: *"Souboj není správně nakonfigurován."* and does not navigate |
| localStorage unavailable (private browsing, storage full) | Catch `SecurityError`/`QuotaExceededError` in session helpers, show: *"Nelze uložit postup hry."* — game still renders but progress won't persist |

---

## Testing

- `CharacterCreation` — renders stat inputs, pool counter decrements, submit disabled when pool > 0
- `StoryNodeView` — renders title, content, choice buttons
- `ItemDiscoveryNodeView` — adds new items to session inventory on mount, skips already-owned items
- `CombatView` — round resolution (best-of-3), HP damage formula, item bonus application, luck mechanic (1d6+stesti ≥ 7 → draw), victory/defeat routing, null node_id error state
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
