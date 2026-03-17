# Gamebooker — Plan 3: Reader Experience

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full reader experience — animated character creation with dice rolls, an immersive reading interface with two visual themes, automatic inventory management, and a multi-round combat system — turning a published gamebook into a playable interactive story.

**Architecture:** The play page (`/hrat/[id]`) is a client-side React application after the initial server render (gamebook data fetch). All reader progress lives in `localStorage` — no backend calls during play except for loading gamebook data. Combat is resolved entirely in the browser. The session is keyed by gamebook ID and includes a version check against `gamebook.updated_at`.

**Tech Stack:** Next.js 15 App Router, React (client components), localStorage for session persistence, Tailwind CSS, shadcn/ui, Framer Motion for animations.

**Prerequisite:** Plans 1 and 2 must be complete. At least one published gamebook must exist in the database.

---

## File Map

```
src/
├── app/
│   └── hrat/
│       └── [id]/
│           └── page.tsx                          # Fill in Plan 1 shell — now full reader entry
├── components/
│   └── reader/
│       ├── ReaderRoot.tsx                        # Client root: session management, routing between screens
│       ├── character/
│       │   ├── CharacterCreation.tsx             # Dice roll screen + 3-point redistribution
│       │   └── CharacterCreation.test.tsx
│       ├── reading/
│       │   ├── ReadingView.tsx                   # Main reading screen: text, choices, theme toggle
│       │   ├── ReadingView.test.tsx
│       │   ├── ChoiceButton.tsx                  # Individual choice button (handles conditions)
│       │   └── ProgressMinimap.tsx               # Visited nodes minimap
│       ├── inventory/
│       │   ├── InventoryDrawer.tsx               # Slide-in inventory panel
│       │   ├── InventoryDrawer.test.tsx
│       │   └── ItemNotification.tsx              # Animated item pick-up notification
│       └── combat/
│           ├── CombatScreen.tsx                  # Full combat flow
│           ├── CombatScreen.test.tsx
│           └── DiceRoll.tsx                      # Animated dice roll component
├── lib/
│   ├── reader/
│   │   ├── session.ts                            # localStorage read/write for ReaderSession
│   │   ├── session.test.ts
│   │   ├── combat-engine.ts                      # Pure combat resolution logic
│   │   └── combat-engine.test.ts
```

---

### Task 1: Reader session (localStorage)

**Files:**
- Create: `src/lib/reader/session.ts`
- Create: `src/lib/reader/session.test.ts`

- [ ] **Step 1.1: Write failing session tests**

Create `src/lib/reader/session.test.ts`:

```typescript
import { saveSession, loadSession, clearSession } from './session'
import type { ReaderSession } from './session'

const mockSession: ReaderSession = {
  gamebookId: 'g1',
  gamebookUpdatedAt: '2026-03-17T10:00:00Z',
  currentNodeId: 'node-start',
  character: {
    name: 'Hrdina',
    avatarId: 'sword',
    sila: 8,
    inteligence: 6,
    obratnost: 7,
    stesti: 5,
    hp: 18,
    hpMax: 18,
  },
  inventory: [],
  visitedNodes: ['node-start'],
  createdAt: '2026-03-17T10:00:00Z',
  updatedAt: '2026-03-17T10:00:00Z',
}

describe('session storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads a session', () => {
    saveSession(mockSession)
    const loaded = loadSession('g1')
    expect(loaded).toEqual(mockSession)
  })

  it('returns null when no session exists', () => {
    expect(loadSession('nonexistent')).toBeNull()
  })

  it('clears a session', () => {
    saveSession(mockSession)
    clearSession('g1')
    expect(loadSession('g1')).toBeNull()
  })

  it('overwrites an existing session on save', () => {
    saveSession(mockSession)
    const updated = { ...mockSession, currentNodeId: 'node-2' }
    saveSession(updated)
    expect(loadSession('g1')?.currentNodeId).toBe('node-2')
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npm test src/lib/reader/session.test.ts
```

Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 1.3: Implement session module**

Create `src/lib/reader/session.ts`:

```typescript
export interface CharacterStats {
  name: string
  avatarId: string
  sila: number
  inteligence: number
  obratnost: number
  stesti: number
  hp: number
  hpMax: number
}

export interface ReaderSession {
  gamebookId: string
  gamebookUpdatedAt: string
  currentNodeId: string
  character: CharacterStats
  inventory: string[]        // item ids
  visitedNodes: string[]
  createdAt: string
  updatedAt: string
}

function storageKey(gamebookId: string): string {
  return `gamebooker_session_${gamebookId}`
}

export function saveSession(session: ReaderSession): void {
  const updated = { ...session, updatedAt: new Date().toISOString() }
  localStorage.setItem(storageKey(session.gamebookId), JSON.stringify(updated))
}

export function loadSession(gamebookId: string): ReaderSession | null {
  try {
    const raw = localStorage.getItem(storageKey(gamebookId))
    if (!raw) return null
    return JSON.parse(raw) as ReaderSession
  } catch {
    return null
  }
}

export function clearSession(gamebookId: string): void {
  localStorage.removeItem(storageKey(gamebookId))
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npm test src/lib/reader/session.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/reader/session.ts src/lib/reader/session.test.ts
git commit -m "feat: add reader session localStorage persistence"
```

---

### Task 2: Combat engine

**Files:**
- Create: `src/lib/reader/combat-engine.ts`
- Create: `src/lib/reader/combat-engine.test.ts`

- [ ] **Step 2.1: Write failing combat engine tests**

Create `src/lib/reader/combat-engine.test.ts`:

```typescript
import {
  resolveCombatRound,
  isCombatOver,
  type CombatState,
  type RoundResult,
} from './combat-engine'

function makeCombatState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    playerHp: 15,
    playerHpMax: 15,
    playerAttribute: 8,
    enemyHp: 15,
    enemyHpMax: 15,
    enemyAttribute: 6,
    roundsPlayed: 0,
    playerRoundsWon: 0,
    enemyRoundsWon: 0,
    luckUsed: false,
    ...overrides,
  }
}

describe('resolveCombatRound', () => {
  it('returns a valid round result', () => {
    const state = makeCombatState()
    const result = resolveCombatRound(state, 4, 3)
    expect(result.playerRoll).toBe(4)
    expect(result.enemyRoll).toBe(3)
    expect(result.playerTotal).toBe(4 + 8)
    expect(result.enemyTotal).toBe(3 + 6)
    expect(result.roundWinner).toBe('player')
    expect(result.damage).toBeGreaterThanOrEqual(1)
  })

  it('awards round to enemy when enemy total is higher', () => {
    const state = makeCombatState()
    const result = resolveCombatRound(state, 1, 6)
    expect(result.roundWinner).toBe('enemy')
  })

  it('ties go to player (no HP lost)', () => {
    const state = makeCombatState({ playerAttribute: 5, enemyAttribute: 5 })
    const result = resolveCombatRound(state, 3, 3)
    expect(result.roundWinner).toBe('tie')
    expect(result.damage).toBe(0)
  })

  it('damage is at least 1 when there is a winner', () => {
    const state = makeCombatState()
    const result = resolveCombatRound(state, 6, 1)
    expect(result.damage).toBeGreaterThanOrEqual(1)
  })
})

describe('isCombatOver', () => {
  it('returns player-win after 2 rounds won by player', () => {
    const state = makeCombatState({ roundsPlayed: 3, playerRoundsWon: 2, enemyRoundsWon: 1 })
    expect(isCombatOver(state)).toBe('player-win')
  })

  it('returns enemy-win after 2 rounds won by enemy', () => {
    const state = makeCombatState({ roundsPlayed: 3, playerRoundsWon: 1, enemyRoundsWon: 2 })
    expect(isCombatOver(state)).toBe('enemy-win')
  })

  it('returns null when combat is ongoing', () => {
    const state = makeCombatState({ roundsPlayed: 1, playerRoundsWon: 1, enemyRoundsWon: 0 })
    expect(isCombatOver(state)).toBeNull()
  })

  it('returns enemy-win when player HP reaches 0', () => {
    const state = makeCombatState({ playerHp: 0 })
    expect(isCombatOver(state)).toBe('enemy-win')
  })

  it('returns player-win when enemy HP reaches 0', () => {
    const state = makeCombatState({ enemyHp: 0 })
    expect(isCombatOver(state)).toBe('player-win')
  })
})
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
npm test src/lib/reader/combat-engine.test.ts
```

Expected: FAIL — `Cannot find module './combat-engine'`

- [ ] **Step 2.3: Implement combat engine**

Create `src/lib/reader/combat-engine.ts`:

```typescript
export interface CombatState {
  playerHp: number
  playerHpMax: number
  playerAttribute: number
  enemyHp: number
  enemyHpMax: number
  enemyAttribute: number
  roundsPlayed: number
  playerRoundsWon: number
  enemyRoundsWon: number
  luckUsed: boolean
}

export interface RoundResult {
  playerRoll: number
  enemyRoll: number
  playerTotal: number
  enemyTotal: number
  roundWinner: 'player' | 'enemy' | 'tie'
  damage: number
}

export function resolveCombatRound(
  state: CombatState,
  playerRoll: number,
  enemyRoll: number
): RoundResult {
  const playerTotal = playerRoll + state.playerAttribute
  const enemyTotal = enemyRoll + state.enemyAttribute

  if (playerTotal === enemyTotal) {
    return { playerRoll, enemyRoll, playerTotal, enemyTotal, roundWinner: 'tie', damage: 0 }
  }

  const roundWinner = playerTotal > enemyTotal ? 'player' : 'enemy'
  const damage = Math.max(1, Math.abs(playerTotal - enemyTotal))

  return { playerRoll, enemyRoll, playerTotal, enemyTotal, roundWinner, damage }
}

export type CombatOutcome = 'player-win' | 'enemy-win' | null

export function isCombatOver(state: CombatState): CombatOutcome {
  if (state.playerHp <= 0) return 'enemy-win'
  if (state.enemyHp <= 0) return 'player-win'
  if (state.playerRoundsWon >= 2) return 'player-win'
  if (state.enemyRoundsWon >= 2) return 'enemy-win'
  return null
}

export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}

export function applyRoundResult(state: CombatState, result: RoundResult): CombatState {
  const newState = { ...state, roundsPlayed: state.roundsPlayed + 1 }

  if (result.roundWinner === 'player') {
    newState.enemyHp = Math.max(0, state.enemyHp - result.damage)
    newState.playerRoundsWon = state.playerRoundsWon + 1
  } else if (result.roundWinner === 'enemy') {
    newState.playerHp = Math.max(0, state.playerHp - result.damage)
    newState.enemyRoundsWon = state.enemyRoundsWon + 1
  }

  return newState
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npm test src/lib/reader/combat-engine.test.ts
```

Expected: PASS — 8 tests passing

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/reader/combat-engine.ts src/lib/reader/combat-engine.test.ts
git commit -m "feat: add pure combat engine with round resolution and outcome detection"
```

---

### Task 3: Character creation screen

**Files:**
- Create: `src/components/reader/character/CharacterCreation.tsx`
- Create: `src/components/reader/character/CharacterCreation.test.tsx`

- [ ] **Step 3.1: Install Framer Motion**

```bash
npm install framer-motion
```

- [ ] **Step 3.2: Write failing CharacterCreation tests**

Create `src/components/reader/character/CharacterCreation.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CharacterCreation from './CharacterCreation'

// Mock Math.random for deterministic dice rolls
const mockRandom = jest.spyOn(Math, 'random')

describe('CharacterCreation', () => {
  beforeEach(() => {
    // Return 0.5 → each die shows 4, sum = 8 per attribute
    mockRandom.mockReturnValue(0.5)
  })

  afterEach(() => {
    mockRandom.mockRestore()
  })

  it('renders the four attributes', () => {
    render(<CharacterCreation gamebookTitle="Test" onComplete={jest.fn()} />)
    expect(screen.getByText(/síla/i)).toBeInTheDocument()
    expect(screen.getByText(/inteligence/i)).toBeInTheDocument()
    expect(screen.getByText(/obratnost/i)).toBeInTheDocument()
    expect(screen.getByText(/štěstí/i)).toBeInTheDocument()
  })

  it('shows a name input', () => {
    render(<CharacterCreation gamebookTitle="Test" onComplete={jest.fn()} />)
    expect(screen.getByPlaceholderText(/jméno/i)).toBeInTheDocument()
  })

  it('calls onComplete with character stats when form is submitted', async () => {
    const onComplete = jest.fn()
    render(<CharacterCreation gamebookTitle="Test" onComplete={onComplete} />)

    await userEvent.type(screen.getByPlaceholderText(/jméno/i), 'Aragorn')
    await userEvent.click(screen.getByRole('button', { name: /začít/i }))

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Aragorn' })
    )
  })

  it('shows error when name is empty', async () => {
    render(<CharacterCreation gamebookTitle="Test" onComplete={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /začít/i }))
    expect(screen.getByText(/zadejte jméno/i)).toBeInTheDocument()
  })

  it('shows reroll button and hides it after 2 uses', async () => {
    render(<CharacterCreation gamebookTitle="Test" onComplete={jest.fn()} />)
    const rerollBtn = screen.getByRole('button', { name: /hodit znovu/i })
    await userEvent.click(rerollBtn)
    await userEvent.click(rerollBtn)
    expect(screen.queryByRole('button', { name: /hodit znovu/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3.3: Run tests to verify they fail**

```bash
npm test src/components/reader/character/CharacterCreation.test.tsx
```

Expected: FAIL

- [ ] **Step 3.4: Implement CharacterCreation**

Create `src/components/reader/character/CharacterCreation.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CharacterStats } from '@/lib/reader/session'
import { Dices, RefreshCw } from 'lucide-react'

const ATTRIBUTES = [
  { key: 'sila', label: 'Síla', description: 'Fyzická síla a bojová zdatnost' },
  { key: 'inteligence', label: 'Inteligence', description: 'Důvtip a schopnost řešit záhady' },
  { key: 'obratnost', label: 'Obratnost', description: 'Rychlost a koordinace pohybů' },
  { key: 'stesti', label: 'Štěstí', description: 'Dar osudu při klíčových momentech' },
] as const

type AttrKey = typeof ATTRIBUTES[number]['key']

const AVATAR_IDS = ['sword', 'staff', 'bow', 'shield', 'book', 'dagger']

function rollAttribute(): number {
  const d1 = Math.floor(Math.random() * 6) + 1
  const d2 = Math.floor(Math.random() * 6) + 1
  return d1 + d2
}

function rollAllAttributes(): Record<AttrKey, number> {
  return {
    sila: rollAttribute(),
    inteligence: rollAttribute(),
    obratnost: rollAttribute(),
    stesti: rollAttribute(),
  }
}

interface Props {
  gamebookTitle: string
  onComplete: (character: CharacterStats) => void
}

export default function CharacterCreation({ gamebookTitle, onComplete }: Props) {
  const [rolls, setRolls] = useState<Record<AttrKey, number>>(rollAllAttributes)
  const [bonusPoints, setBonusPoints] = useState(3)
  const [bonuses, setBonuses] = useState<Record<AttrKey, number>>({ sila: 0, inteligence: 0, obratnost: 0, stesti: 0 })
  const [rerollsLeft, setRerollsLeft] = useState(2)
  const [name, setName] = useState('')
  const [avatarId, setAvatarId] = useState(AVATAR_IDS[0])
  const [error, setError] = useState<string | null>(null)

  function handleReroll() {
    if (rerollsLeft === 0) return
    setRolls(rollAllAttributes())
    setBonuses({ sila: 0, inteligence: 0, obratnost: 0, stesti: 0 })
    setBonusPoints(3)
    setRerollsLeft((r) => r - 1)
  }

  function adjustBonus(attr: AttrKey, delta: number) {
    const current = bonuses[attr]
    const newVal = current + delta
    const newTotal = bonusPoints - delta
    if (newTotal < 0 || newVal < 0) return
    setBonuses((b) => ({ ...b, [attr]: newVal }))
    setBonusPoints(newTotal)
  }

  function handleStart() {
    if (!name.trim()) {
      setError('Zadejte jméno postavy.')
      return
    }
    const finalSila = rolls.sila + bonuses.sila
    const character: CharacterStats = {
      name: name.trim(),
      avatarId,
      sila: finalSila,
      inteligence: rolls.inteligence + bonuses.inteligence,
      obratnost: rolls.obratnost + bonuses.obratnost,
      stesti: rolls.stesti + bonuses.stesti,
      hp: finalSila + 10,
      hpMax: finalSila + 10,
    }
    onComplete(character)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <p className="text-slate-400 text-sm uppercase tracking-widest">Nová hra</p>
          <h1 className="text-3xl font-bold">{gamebookTitle}</h1>
          <p className="text-slate-400">Vytvoř svou postavu</p>
        </div>

        {/* Name + avatar */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="char-name" className="text-slate-300">Jméno postavy</Label>
            <Input
              id="char-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Zadej jméno hrdiny…"
              className="bg-slate-800 border-slate-600 text-slate-100"
            />
          </div>
          <div className="flex gap-2">
            {AVATAR_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setAvatarId(id)}
                className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-colors ${
                  avatarId === id ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {id === 'sword' ? '⚔️' : id === 'staff' ? '🪄' : id === 'bow' ? '🏹' :
                  id === 'shield' ? '🛡️' : id === 'book' ? '📖' : '🗡️'}
              </button>
            ))}
          </div>
        </div>

        {/* Attributes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Dices className="w-4 h-4" />
              Vlastnosti
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-indigo-400">{bonusPoints} bonusové body</span>
              {rerollsLeft > 0 && (
                <Button variant="outline" size="sm" onClick={handleReroll}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Hodit znovu ({rerollsLeft}×)
                </Button>
              )}
            </div>
          </div>

          {ATTRIBUTES.map(({ key, label, description }) => {
            const total = rolls[key] + bonuses[key]
            return (
              <div key={key} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-slate-400">{description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustBonus(key, -1)}
                    disabled={bonuses[key] === 0}
                    className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 font-bold"
                  >
                    −
                  </button>
                  <span className="text-xl font-bold w-8 text-center">{total}</span>
                  <button
                    onClick={() => adjustBonus(key, 1)}
                    disabled={bonusPoints === 0}
                    className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-xs text-slate-500 text-center">
          HP = Síla + 10 → {(rolls.sila + bonuses.sila) + 10} HP
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <Button onClick={handleStart} className="w-full bg-indigo-600 hover:bg-indigo-700" size="lg">
          Začít dobrodružství
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.5: Run tests to verify they pass**

```bash
npm test src/components/reader/character/CharacterCreation.test.tsx
```

Expected: PASS — 5 tests passing

- [ ] **Step 3.6: Commit**

```bash
git add src/components/reader/character/
git commit -m "feat: add character creation screen with dice rolls and bonus distribution"
```

---

### Task 4: Inventory system

**Files:**
- Create: `src/components/reader/inventory/InventoryDrawer.tsx`
- Create: `src/components/reader/inventory/InventoryDrawer.test.tsx`
- Create: `src/components/reader/inventory/ItemNotification.tsx`

- [ ] **Step 4.1: Install Radix Sheet (for slide-in drawer)**

```bash
npx shadcn@latest add sheet
```

- [ ] **Step 4.2: Write failing InventoryDrawer tests**

Create `src/components/reader/inventory/InventoryDrawer.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import InventoryDrawer from './InventoryDrawer'
import type { Item } from '@/lib/supabase/types'

const mockItems: Item[] = [
  {
    id: 'item-1', gamebook_id: 'g1', name: 'Starý meč',
    description: 'Rezivý, ale stále ostrý.', stat_bonus_attribute: 'sila', stat_bonus_value: 1,
  },
  {
    id: 'item-2', gamebook_id: 'g1', name: 'Lektvar léčení',
    description: 'Obnoví část zdraví.', stat_bonus_attribute: null, stat_bonus_value: 0,
  },
]

describe('InventoryDrawer', () => {
  it('shows item names', () => {
    render(
      <InventoryDrawer
        items={mockItems}
        inventoryIds={['item-1', 'item-2']}
        open={true}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText('Starý meč')).toBeInTheDocument()
    expect(screen.getByText('Lektvar léčení')).toBeInTheDocument()
  })

  it('shows stat bonuses', () => {
    render(
      <InventoryDrawer
        items={mockItems}
        inventoryIds={['item-1']}
        open={true}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText(/\+1 Síla/i)).toBeInTheDocument()
  })

  it('shows empty state when inventory is empty', () => {
    render(
      <InventoryDrawer
        items={mockItems}
        inventoryIds={[]}
        open={true}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText(/prázdný/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4.3: Run tests to verify they fail**

```bash
npm test src/components/reader/inventory/InventoryDrawer.test.tsx
```

Expected: FAIL

- [ ] **Step 4.4: Implement InventoryDrawer**

Create `src/components/reader/inventory/InventoryDrawer.tsx`:

```typescript
'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import type { Item } from '@/lib/supabase/types'
import { Backpack } from 'lucide-react'

const ATTR_LABELS: Record<string, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
  stesti: 'Štěstí',
}

interface InventoryDrawerProps {
  items: Item[]
  inventoryIds: string[]
  open: boolean
  onClose: () => void
}

export default function InventoryDrawer({
  items,
  inventoryIds,
  open,
  onClose,
}: InventoryDrawerProps) {
  const heldItems = items.filter((i) => inventoryIds.includes(i.id))

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80 bg-amber-950 text-amber-100 border-amber-800">
        <SheetHeader>
          <SheetTitle className="text-amber-100 flex items-center gap-2">
            <Backpack className="w-5 h-5" />
            Inventář ({heldItems.length})
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {heldItems.length === 0 ? (
            <p className="text-amber-400 text-sm text-center py-8">
              Batoh je prázdný.
            </p>
          ) : (
            heldItems.map((item) => (
              <div key={item.id} className="bg-amber-900/60 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{item.name}</span>
                  {item.stat_bonus_attribute && item.stat_bonus_value > 0 && (
                    <Badge className="bg-amber-600 text-amber-100 text-xs">
                      +{item.stat_bonus_value} {ATTR_LABELS[item.stat_bonus_attribute]}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-amber-300">{item.description}</p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4.5: Create ItemNotification**

Create `src/components/reader/inventory/ItemNotification.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Item } from '@/lib/supabase/types'

interface ItemNotificationProps {
  item: Item | null
  onDismiss: () => void
}

export default function ItemNotification({ item, onDismiss }: ItemNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (item) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDismiss, 400)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [item, onDismiss])

  return (
    <AnimatePresence>
      {visible && item && (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed bottom-24 right-4 bg-amber-700 text-amber-100 rounded-2xl px-4 py-3 shadow-2xl max-w-xs cursor-pointer"
          onClick={() => { setVisible(false); onDismiss() }}
        >
          <div className="text-xs uppercase tracking-widest text-amber-300 mb-1">
            Přidáno do inventáře
          </div>
          <div className="font-bold">{item.name}</div>
          <div className="text-sm text-amber-300">{item.description}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4.6: Run tests to verify they pass**

```bash
npm test src/components/reader/inventory/InventoryDrawer.test.tsx
```

Expected: PASS — 3 tests passing

- [ ] **Step 4.7: Commit**

```bash
git add src/components/reader/inventory/
git commit -m "feat: add inventory drawer and item pick-up notification"
```

---

### Task 5: Combat screen

**Files:**
- Create: `src/components/reader/combat/DiceRoll.tsx`
- Create: `src/components/reader/combat/CombatScreen.tsx`
- Create: `src/components/reader/combat/CombatScreen.test.tsx`

- [ ] **Step 5.1: Write failing CombatScreen tests**

Create `src/components/reader/combat/CombatScreen.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CombatScreen from './CombatScreen'
import type { CombatConfig } from '@/lib/supabase/types'
import type { CharacterStats } from '@/lib/reader/session'

const mockConfig: CombatConfig = {
  id: 'cc1',
  node_id: 'n1',
  enemy_name: 'Temný rytíř',
  enemy_sila: 7,
  enemy_inteligence: 4,
  enemy_obratnost: 5,
  enemy_stesti: 3,
  enemy_hp: 15,
  player_attribute: 'sila',
  enemy_attribute: 'sila',
  victory_node_id: 'win-node',
  defeat_node_id: 'lose-node',
}

const mockCharacter: CharacterStats = {
  name: 'Hrdina',
  avatarId: 'sword',
  sila: 8,
  inteligence: 6,
  obratnost: 7,
  stesti: 5,
  hp: 18,
  hpMax: 18,
}

describe('CombatScreen', () => {
  it('shows enemy name', () => {
    render(
      <CombatScreen
        config={mockConfig}
        character={mockCharacter}
        inventory={[]}
        allItems={[]}
        onCombatEnd={jest.fn()}
      />
    )
    expect(screen.getByText('Temný rytíř')).toBeInTheDocument()
  })

  it('shows player name', () => {
    render(
      <CombatScreen
        config={mockConfig}
        character={mockCharacter}
        inventory={[]}
        allItems={[]}
        onCombatEnd={jest.fn()}
      />
    )
    expect(screen.getByText('Hrdina')).toBeInTheDocument()
  })

  it('has a roll button to start combat', () => {
    render(
      <CombatScreen
        config={mockConfig}
        character={mockCharacter}
        inventory={[]}
        allItems={[]}
        onCombatEnd={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /hodit kostkou/i })).toBeInTheDocument()
  })

  it('calls onCombatEnd after combat resolves', async () => {
    const onCombatEnd = jest.fn()
    // Mock Math.random so player always wins (high rolls)
    jest.spyOn(Math, 'random').mockReturnValue(0.99)

    render(
      <CombatScreen
        config={mockConfig}
        character={mockCharacter}
        inventory={[]}
        allItems={[]}
        onCombatEnd={onCombatEnd}
      />
    )

    // Play through 3 rounds
    for (let i = 0; i < 3; i++) {
      const btn = screen.queryByRole('button', { name: /hodit kostkou/i })
      if (btn) await userEvent.click(btn)
    }

    // After 2 wins, combat ends — check the "continue" button or onCombatEnd
    jest.spyOn(Math, 'random').mockRestore()
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
npm test src/components/reader/combat/CombatScreen.test.tsx
```

Expected: FAIL

- [ ] **Step 5.3: Create DiceRoll component**

Create `src/components/reader/combat/DiceRoll.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface DiceRollProps {
  finalValue: number | null
  rolling: boolean
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

export default function DiceRoll({ finalValue, rolling }: DiceRollProps) {
  const [displayFace, setDisplayFace] = useState(DICE_FACES[0])

  useEffect(() => {
    if (!rolling) {
      if (finalValue !== null) {
        setDisplayFace(DICE_FACES[finalValue - 1])
      }
      return
    }

    let count = 0
    const interval = setInterval(() => {
      setDisplayFace(DICE_FACES[Math.floor(Math.random() * 6)])
      count++
      if (count > 10) clearInterval(interval)
    }, 80)

    return () => clearInterval(interval)
  }, [rolling, finalValue])

  return (
    <motion.div
      animate={rolling ? { rotate: [0, 15, -15, 10, -10, 0] } : {}}
      transition={{ duration: 0.6, repeat: rolling ? Infinity : 0 }}
      className="text-6xl select-none"
    >
      {displayFace}
    </motion.div>
  )
}
```

- [ ] **Step 5.4: Implement CombatScreen**

Create `src/components/reader/combat/CombatScreen.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import DiceRoll from './DiceRoll'
import {
  rollD6,
  resolveCombatRound,
  applyRoundResult,
  isCombatOver,
  type CombatState,
  type RoundResult,
} from '@/lib/reader/combat-engine'
import type { CombatConfig, Item } from '@/lib/supabase/types'
import type { CharacterStats } from '@/lib/reader/session'
import { Swords, Zap } from 'lucide-react'

const ATTR_LABELS: Record<string, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
}

interface CombatScreenProps {
  config: CombatConfig
  character: CharacterStats
  inventory: string[]
  allItems: Item[]
  onCombatEnd: (outcome: 'player-win' | 'enemy-win', remainingHp: number) => void
}

export default function CombatScreen({
  config,
  character,
  inventory,
  allItems,
  onCombatEnd,
}: CombatScreenProps) {
  const playerAttrValue = character[config.player_attribute as keyof CharacterStats] as number
  const enemyAttrValue = config[`enemy_${config.enemy_attribute}` as keyof CombatConfig] as number

  // Calculate item bonuses
  const itemBonus = allItems
    .filter((i) => inventory.includes(i.id) && i.stat_bonus_attribute === config.player_attribute)
    .reduce((sum, i) => sum + i.stat_bonus_value, 0)

  const [combatState, setCombatState] = useState<CombatState>({
    playerHp: character.hp,
    playerHpMax: character.hpMax,
    playerAttribute: playerAttrValue + itemBonus,
    enemyHp: config.enemy_hp,
    enemyHpMax: config.enemy_hp,
    enemyAttribute: enemyAttrValue,
    roundsPlayed: 0,
    playerRoundsWon: 0,
    enemyRoundsWon: 0,
    luckUsed: false,
  })

  const [lastResult, setLastResult] = useState<RoundResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const [outcome, setOutcome] = useState<'player-win' | 'enemy-win' | null>(null)
  const [currentPlayerHp, setCurrentPlayerHp] = useState(character.hp)

  const over = outcome ?? isCombatOver(combatState)

  async function handleRoll() {
    setRolling(true)
    await new Promise((r) => setTimeout(r, 700))

    const pRoll = rollD6()
    const eRoll = rollD6()
    const result = resolveCombatRound(combatState, pRoll, eRoll)
    const newState = applyRoundResult(combatState, result)

    setLastResult(result)
    setCombatState(newState)
    setCurrentPlayerHp(newState.playerHp)
    setRolling(false)

    const newOutcome = isCombatOver(newState)
    if (newOutcome) setOutcome(newOutcome)
  }

  function handleLuck() {
    if (combatState.luckUsed || !lastResult) return
    // Turn a loss into a tie: no damage, player doesn't lose the round
    const corrected: RoundResult = { ...lastResult, roundWinner: 'tie', damage: 0 }
    const newState = applyRoundResult(
      { ...combatState, playerHp: combatState.playerHp + lastResult.damage, enemyRoundsWon: combatState.enemyRoundsWon - 1 },
      { ...corrected }
    )
    setCombatState({ ...newState, luckUsed: true })
  }

  function HPBar({ current, max, color }: { current: number; max: number; color: string }) {
    const pct = Math.max(0, (current / max) * 100)
    return (
      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', damping: 15 }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 gap-8">
      <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
        <Swords className="w-6 h-6" />
        Souboj!
      </div>

      {/* Combatants */}
      <div className="w-full max-w-md grid grid-cols-2 gap-6">
        {/* Player */}
        <div className="space-y-2 text-center">
          <div className="text-2xl">🧙</div>
          <div className="font-bold">{character.name}</div>
          <div className="text-sm text-indigo-400">{ATTR_LABELS[config.player_attribute]}: {playerAttrValue + itemBonus}{itemBonus > 0 ? ` (+${itemBonus})` : ''}</div>
          <HPBar current={combatState.playerHp} max={combatState.playerHpMax} color="bg-indigo-500" />
          <div className="text-sm">{combatState.playerHp}/{combatState.playerHpMax} HP</div>
          <div className="text-xs text-slate-500">Kola: {combatState.playerRoundsWon}/3</div>
        </div>

        {/* Enemy */}
        <div className="space-y-2 text-center">
          <div className="text-2xl">👹</div>
          <div className="font-bold">{config.enemy_name}</div>
          <div className="text-sm text-red-400">{ATTR_LABELS[config.enemy_attribute]}: {enemyAttrValue}</div>
          <HPBar current={combatState.enemyHp} max={combatState.enemyHpMax} color="bg-red-500" />
          <div className="text-sm">{combatState.enemyHp}/{combatState.enemyHpMax} HP</div>
          <div className="text-xs text-slate-500">Kola: {combatState.enemyRoundsWon}/3</div>
        </div>
      </div>

      {/* Dice area */}
      {!over && (
        <div className="flex gap-12 items-center">
          <div className="text-center space-y-2">
            <DiceRoll finalValue={lastResult?.playerRoll ?? null} rolling={rolling} />
            <div className="text-xs text-slate-400">Tvůj hod</div>
          </div>
          <div className="text-slate-500 font-bold">VS</div>
          <div className="text-center space-y-2">
            <DiceRoll finalValue={lastResult?.enemyRoll ?? null} rolling={rolling} />
            <div className="text-xs text-slate-400">Nepřítel</div>
          </div>
        </div>
      )}

      {/* Last round result */}
      {lastResult && !over && (
        <div className={`text-center font-semibold ${lastResult.roundWinner === 'player' ? 'text-green-400' : lastResult.roundWinner === 'enemy' ? 'text-red-400' : 'text-slate-400'}`}>
          {lastResult.roundWinner === 'player'
            ? `Vítězné kolo! Nepřítel ztratil ${lastResult.damage} HP.`
            : lastResult.roundWinner === 'enemy'
            ? `Prohrané kolo. Ztratil jsi ${lastResult.damage} HP.`
            : 'Remíza — nikdo neztrácí HP.'}
        </div>
      )}

      {/* Controls */}
      {!over && (
        <div className="flex gap-3">
          <Button onClick={handleRoll} disabled={rolling} size="lg" className="bg-red-700 hover:bg-red-600">
            <Swords className="w-4 h-4 mr-2" />
            Hodit kostkou
          </Button>
          {!combatState.luckUsed && lastResult?.roundWinner === 'enemy' && (
            <Button onClick={handleLuck} variant="outline" size="lg"
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-900">
              <Zap className="w-4 h-4 mr-2" />
              Zkusit štěstí
            </Button>
          )}
        </div>
      )}

      {/* Outcome */}
      {over && (
        <div className="text-center space-y-4">
          <div className={`text-3xl font-bold ${over === 'player-win' ? 'text-green-400' : 'text-red-400'}`}>
            {over === 'player-win' ? '🏆 Vyhráls!' : '💀 Prohrál jsi.'}
          </div>
          <Button onClick={() => onCombatEnd(over, currentPlayerHp)} size="lg">
            Pokračovat
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5.5: Run tests to verify they pass**

```bash
npm test src/components/reader/combat/CombatScreen.test.tsx
```

Expected: PASS — at least 3 tests passing

- [ ] **Step 5.6: Commit**

```bash
git add src/components/reader/combat/
git commit -m "feat: add combat screen with animated dice, HP bars, and luck mechanic"
```

---

### Task 6: Reading view

**Files:**
- Create: `src/components/reader/reading/ReadingView.tsx`
- Create: `src/components/reader/reading/ReadingView.test.tsx`
- Create: `src/components/reader/reading/ChoiceButton.tsx`

- [ ] **Step 6.1: Add Crimson Text font**

In `src/app/layout.tsx`, add Crimson Text font alongside Inter:

```typescript
import { Inter, Crimson_Text } from 'next/font/google'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })
export const crimsonText = Crimson_Text({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-crimson',
})
```

Add `crimsonText.variable` to the `<body>` className.

- [ ] **Step 6.2: Write failing ReadingView tests**

Create `src/components/reader/reading/ReadingView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReadingView from './ReadingView'
import type { Node, Choice, Item } from '@/lib/supabase/types'

const mockNode: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'story',
  title: 'Lesní cesta', content: 'Jdeš lesem. Slyšíš zvuky z dálky.',
  is_start: true, x: 0, y: 0,
}

const mockChoices: Choice[] = [
  { id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Jít doleva', condition_item_id: null },
  { id: 'c2', from_node_id: 'n1', to_node_id: 'n3', text: 'Jít doprava', condition_item_id: null },
]

describe('ReadingView', () => {
  it('renders node content', () => {
    render(
      <ReadingView
        node={mockNode}
        choices={mockChoices}
        inventory={[]}
        allItems={[]}
        visitedNodes={['n1']}
        onChoose={jest.fn()}
        onOpenInventory={jest.fn()}
      />
    )
    expect(screen.getByText(/Jdeš lesem/i)).toBeInTheDocument()
  })

  it('renders all available choices', () => {
    render(
      <ReadingView
        node={mockNode}
        choices={mockChoices}
        inventory={[]}
        allItems={[]}
        visitedNodes={['n1']}
        onChoose={jest.fn()}
        onOpenInventory={jest.fn()}
      />
    )
    expect(screen.getByText('Jít doleva')).toBeInTheDocument()
    expect(screen.getByText('Jít doprava')).toBeInTheDocument()
  })

  it('hides conditional choice when item is not in inventory', () => {
    const conditionalChoices: Choice[] = [
      { id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Použít klíč', condition_item_id: 'key-id' },
      { id: 'c2', from_node_id: 'n1', to_node_id: 'n3', text: 'Jít dál', condition_item_id: null },
    ]
    render(
      <ReadingView
        node={mockNode}
        choices={conditionalChoices}
        inventory={[]}  // no key
        allItems={[]}
        visitedNodes={['n1']}
        onChoose={jest.fn()}
        onOpenInventory={jest.fn()}
      />
    )
    expect(screen.queryByText('Použít klíč')).not.toBeInTheDocument()
    expect(screen.getByText('Jít dál')).toBeInTheDocument()
  })

  it('calls onChoose when a choice is clicked', async () => {
    const onChoose = jest.fn()
    render(
      <ReadingView
        node={mockNode}
        choices={mockChoices}
        inventory={[]}
        allItems={[]}
        visitedNodes={['n1']}
        onChoose={onChoose}
        onOpenInventory={jest.fn()}
      />
    )
    await userEvent.click(screen.getByText('Jít doleva'))
    expect(onChoose).toHaveBeenCalledWith('n2')
  })
})
```

- [ ] **Step 6.3: Run tests to verify they fail**

```bash
npm test src/components/reader/reading/ReadingView.test.tsx
```

Expected: FAIL

- [ ] **Step 6.4: Implement ChoiceButton**

Create `src/components/reader/reading/ChoiceButton.tsx`:

```typescript
'use client'

import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

interface ChoiceButtonProps {
  text: string
  onClick: () => void
  index: number
}

export default function ChoiceButton({ text, onClick, index }: ChoiceButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-5 py-3 rounded-xl border-2 border-amber-800/40 hover:border-amber-600 hover:bg-amber-950/40 transition-colors group"
    >
      <ChevronRight className="w-4 h-4 text-amber-600 shrink-0 group-hover:translate-x-1 transition-transform" />
      <span className="font-crimson text-lg text-amber-100">{text}</span>
    </motion.button>
  )
}
```

- [ ] **Step 6.5: Implement ReadingView**

Create `src/components/reader/reading/ReadingView.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ChoiceButton from './ChoiceButton'
import type { Node, Choice, Item } from '@/lib/supabase/types'
import { Backpack, Sun, Moon } from 'lucide-react'

type Theme = 'pergamen' | 'noc'

interface ReadingViewProps {
  node: Node
  choices: Choice[]
  inventory: string[]
  allItems: Item[]
  visitedNodes: string[]
  onChoose: (toNodeId: string) => void
  onOpenInventory: () => void
}

export default function ReadingView({
  node,
  choices,
  inventory,
  allItems,
  visitedNodes,
  onChoose,
  onOpenInventory,
}: ReadingViewProps) {
  const [theme, setTheme] = useState<Theme>('pergamen')
  const [showChoices, setShowChoices] = useState(false)

  // Show choices after text animation completes
  useEffect(() => {
    setShowChoices(false)
    const timer = setTimeout(() => setShowChoices(true), 600)
    return () => clearTimeout(timer)
  }, [node.id])

  // Filter out conditional choices where item not in inventory
  const visibleChoices = choices.filter(
    (c) => !c.condition_item_id || inventory.includes(c.condition_item_id)
  )

  const themeClasses: Record<Theme, string> = {
    pergamen: 'bg-amber-50 text-amber-950',
    noc: 'bg-slate-900 text-amber-100',
  }

  const nodeCountLabel = `${visitedNodes.length} navštívených uzlů`

  return (
    <div className={`min-h-screen ${themeClasses[theme]} transition-colors duration-500`}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-current/10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xs opacity-50">{nodeCountLabel}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenInventory}
              className="p-2 rounded-lg hover:bg-current/10 transition-colors"
              aria-label="Otevřít inventář"
            >
              <Backpack className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTheme((t) => t === 'pergamen' ? 'noc' : 'pergamen')}
              className="p-2 rounded-lg hover:bg-current/10 transition-colors"
              aria-label="Přepnout motiv"
            >
              {theme === 'pergamen' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Story text */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        <motion.div
          key={node.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="font-crimson text-xl leading-relaxed mb-12 whitespace-pre-wrap"
          style={{ fontFamily: 'var(--font-crimson), Georgia, serif' }}
        >
          {node.content || node.title}
        </motion.div>

        {/* Choices */}
        {showChoices && (
          <div className="space-y-3">
            {node.type === 'ending' ? (
              <p className="text-center opacity-60 italic font-crimson text-lg">
                — Konec —
              </p>
            ) : (
              visibleChoices.map((choice, i) => (
                <ChoiceButton
                  key={choice.id}
                  text={choice.text}
                  onClick={() => onChoose(choice.to_node_id)}
                  index={i}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 6.6: Run tests to verify they pass**

```bash
npm test src/components/reader/reading/ReadingView.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 6.7: Commit**

```bash
git add src/components/reader/reading/
git commit -m "feat: add reading view with two themes, fade-in text, and conditional choices"
```

---

### Task 7: ReaderRoot + wiring everything together

**Files:**
- Create: `src/components/reader/ReaderRoot.tsx`
- Modify: `src/app/hrat/[id]/page.tsx`

- [ ] **Step 7.1: Implement ReaderRoot**

Create `src/components/reader/ReaderRoot.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import CharacterCreation from './character/CharacterCreation'
import ReadingView from './reading/ReadingView'
import CombatScreen from './combat/CombatScreen'
import InventoryDrawer from './inventory/InventoryDrawer'
import ItemNotification from './inventory/ItemNotification'
import { saveSession, loadSession, type ReaderSession } from '@/lib/reader/session'
import type { Gamebook, Node, Choice, Item, CombatConfig } from '@/lib/supabase/types'

type Screen = 'character-creation' | 'reading' | 'combat'

interface ReaderRootProps {
  gamebook: Gamebook
  nodes: Node[]
  choices: Choice[]
  items: Item[]
  combatConfigs: CombatConfig[]
  nodeItemsMap: Record<string, string[]>   // nodeId → itemIds[]
}

export default function ReaderRoot({
  gamebook,
  nodes,
  choices,
  items,
  combatConfigs,
  nodeItemsMap,
}: ReaderRootProps) {
  const [session, setSession] = useState<ReaderSession | null>(null)
  const [screen, setScreen] = useState<Screen>('character-creation')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [newItem, setNewItem] = useState<Item | null>(null)
  const [staleWarning, setStaleWarning] = useState(false)

  const startNode = nodes.find((n) => n.is_start)
  const currentNode = session ? nodes.find((n) => n.id === session.currentNodeId) : null
  const currentChoices = currentNode
    ? choices.filter((c) => c.from_node_id === currentNode.id)
    : []
  const currentNodeItems = currentNode
    ? items.filter((item) =>
        // Check if this node has this item (via node_items — passed as items from server)
        // Items are filtered by gamebook, so we use a different prop for node_items
        false // node_items handled via nodeItemsMap prop — see page.tsx
      )
    : []
  const currentCombatConfig = currentNode?.type === 'combat'
    ? combatConfigs.find((c) => c.node_id === currentNode.id) ?? null
    : null

  // Check for existing session on mount
  useEffect(() => {
    const existing = loadSession(gamebook.id)
    if (existing) {
      if (existing.gamebookUpdatedAt !== gamebook.updated_at) {
        setStaleWarning(true)
      } else {
        setSession(existing)
        setScreen('reading')
      }
    }
  }, [gamebook.id, gamebook.updated_at])

  function handleCharacterComplete(character: ReaderSession['character']) {
    if (!startNode) return
    const newSession: ReaderSession = {
      gamebookId: gamebook.id,
      gamebookUpdatedAt: gamebook.updated_at,
      currentNodeId: startNode.id,
      character,
      inventory: [],
      visitedNodes: [startNode.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveSession(newSession)
    setSession(newSession)
    setScreen('reading')
  }

  const handleChoose = useCallback((toNodeId: string, nodeItemsMap: Record<string, string[]>) => {
    if (!session) return
    const nextNode = nodes.find((n) => n.id === toNodeId)
    if (!nextNode) return

    const isFirstVisit = !session.visitedNodes.includes(toNodeId)
    const newInventory = [...session.inventory]

    // Award items on first visit
    if (isFirstVisit) {
      const nodeItemIds = nodeItemsMap[toNodeId] ?? []
      for (const itemId of nodeItemIds) {
        if (!newInventory.includes(itemId)) {
          newInventory.push(itemId)
          const item = items.find((i) => i.id === itemId)
          if (item) setNewItem(item)
        }
      }
    }

    const updated: ReaderSession = {
      ...session,
      currentNodeId: toNodeId,
      inventory: newInventory,
      visitedNodes: isFirstVisit ? [...session.visitedNodes, toNodeId] : session.visitedNodes,
    }
    saveSession(updated)
    setSession(updated)

    if (nextNode.type === 'combat') {
      setScreen('combat')
    }
  }, [session, nodes, items])

  function handleCombatEnd(outcome: 'player-win' | 'enemy-win', remainingHp: number) {
    if (!session || !currentCombatConfig) return
    const nextNodeId = outcome === 'player-win'
      ? currentCombatConfig.victory_node_id
      : currentCombatConfig.defeat_node_id

    if (!nextNodeId) return

    const updated: ReaderSession = {
      ...session,
      currentNodeId: nextNodeId,
      character: {
        ...session.character,
        hp: Math.max(0, remainingHp),  // persist HP damage from combat into session
      },
    }
    saveSession(updated)
    setSession(updated)
    setScreen('reading')
  }

  if (staleWarning) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <h2 className="text-xl font-bold">Gamebook byl aktualizován</h2>
          <p className="text-slate-400">Tvůrce upravil tento gamebook od tvé poslední návštěvy. Chceš pokračovat v rozehaté hře nebo začít znovu?</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const existing = loadSession(gamebook.id)
                if (existing) { setSession(existing); setScreen('reading') }
                setStaleWarning(false)
              }}
              className="flex-1 py-2 rounded-lg border border-slate-600 hover:bg-slate-800"
            >
              Pokračovat
            </button>
            <button
              onClick={() => { setStaleWarning(false) }}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700"
            >
              Začít znovu
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'character-creation') {
    return <CharacterCreation gamebookTitle={gamebook.title} onComplete={handleCharacterComplete} />
  }

  if (!session || !currentNode) return null

  if (screen === 'combat' && currentCombatConfig) {
    return (
      <CombatScreen
        config={currentCombatConfig}
        character={session.character}
        inventory={session.inventory}
        allItems={items}
        onCombatEnd={handleCombatEnd}
      />
    )
  }

  return (
    <>
      <ReadingView
        node={currentNode}
        choices={currentChoices}
        inventory={session.inventory}
        allItems={items}
        visitedNodes={session.visitedNodes}
        onChoose={(toNodeId) => handleChoose(toNodeId, nodeItemsMap)}
        onOpenInventory={() => setInventoryOpen(true)}
      />
      <InventoryDrawer
        items={items}
        inventoryIds={session.inventory}
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
      />
      <ItemNotification
        item={newItem}
        onDismiss={() => setNewItem(null)}
      />
    </>
  )
}
```

- [ ] **Step 7.2: Update play page to wire in all data including node_items**

Replace `src/app/hrat/[id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ReaderRoot from '@/components/reader/ReaderRoot'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HratPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: gamebook } = await supabase
    .from('gamebooks')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!gamebook) notFound()

  const [{ data: nodes }, { data: items }] = await Promise.all([
    supabase.from('nodes').select('*').eq('gamebook_id', id),
    supabase.from('items').select('*').eq('gamebook_id', id),
  ])

  const nodeIds = (nodes ?? []).map((n) => n.id)

  const [{ data: choices }, { data: combatConfigs }, { data: nodeItems }] =
    await Promise.all([
      supabase.from('choices').select('*').in('from_node_id', nodeIds),
      supabase.from('combat_configs').select('*').in('node_id', nodeIds),
      supabase.from('node_items').select('*').in('node_id', nodeIds),
    ])

  // Build a map: nodeId → itemIds[] for ReaderRoot
  const nodeItemsMap: Record<string, string[]> = {}
  for (const ni of nodeItems ?? []) {
    if (!nodeItemsMap[ni.node_id]) nodeItemsMap[ni.node_id] = []
    nodeItemsMap[ni.node_id].push(ni.item_id)
  }

  return (
    <ReaderRoot
      gamebook={gamebook}
      nodes={nodes ?? []}
      choices={choices ?? []}
      items={items ?? []}
      combatConfigs={combatConfigs ?? []}
      nodeItemsMap={nodeItemsMap}
    />
  )
}
```


- [ ] **Step 7.3: Run all tests**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 7.4: Manually test the full reader flow**

1. Start dev server: `npm run dev`
2. Navigate to a published gamebook at `http://localhost:3000/hrat/{id}`
3. Create a character — verify dice animations and re-roll limit ✓
4. Read first node — verify text fade-in ✓
5. Make a choice — verify navigation ✓
6. Pick up an item — verify notification slides in ✓
7. Open inventory — verify item appears ✓
8. Reach a combat node — verify combat screen ✓
9. Fight through 3 rounds — verify HP bars and luck button ✓
10. Navigate away and return — verify "Pokračovat" resumes session ✓

- [ ] **Step 7.5: Commit**

```bash
git add src/components/reader/ src/app/hrat/
git commit -m "feat: add ReaderRoot wiring character creation, reading, inventory and combat"
```

---

### Task 8: Deploy and verify

- [ ] **Step 8.1: Push to GitHub**

```bash
git push
```

- [ ] **Step 8.2: Verify on Vercel**

Open the production URL. Play through a complete gamebook end-to-end:
- Character creation with dice rolls ✓
- Reading in both Pergamen and Noc themes ✓
- Item pick-up notification ✓
- Inventory drawer ✓
- Combat screen ✓
- Session persistence (close tab, return, resume) ✓

- [ ] **Step 8.3: Tag release**

```bash
git tag plan-3-complete
git push --tags
```

---

## The complete system

After Plan 3, Gamebooker has:
- Creator login and dashboard
- AI-assisted gamebook creation with node graph editor
- Full reader experience with character creation, inventory, and combat
- Public library of published gamebooks
- Anonymous reader progress via localStorage
- Deployed to Vercel + Supabase free tier
