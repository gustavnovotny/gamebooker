# Reader Experience Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full reader-side gameplay for `/hrat/[id]` — character creation, node navigation, inventory, and combat — using localStorage for session state and server-rendered pages per node.

**Architecture:** Each node is a Next.js server component page that fetches only the current node's data and passes it to a client `<NodeReader>` wrapper. All player state (HP, stats, inventory) lives in localStorage under `gamebooker_session_<gamebookId>`. Combat logic is extracted into pure exported functions for testability.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase (server-side), @testing-library/react + jest, lucide-react

---

## Setup

- [ ] Create worktree and branch:
```bash
git worktree add .worktrees/plan-3-reader -b feature/plan-3-reader
cd .worktrees/plan-3-reader
```

All subsequent work happens inside `.worktrees/plan-3-reader/`.

---

## Task 1: Session helpers

**Files:**
- Create: `src/lib/reader/session.ts`
- Create: `src/lib/reader/session.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reader/session.test.ts`:

```typescript
import { getSession, saveSession, clearSession } from './session'
import type { GameSession } from './session'

const session: GameSession = {
  gamebookId: 'g1',
  currentNodeId: 'n1',
  hp: 15,
  maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

beforeEach(() => localStorage.clear())

describe('session helpers', () => {
  it('returns null when no session exists', () => {
    expect(getSession('g1')).toBeNull()
  })

  it('saves and retrieves a session', () => {
    saveSession(session)
    expect(getSession('g1')).toEqual(session)
  })

  it('clears a session', () => {
    saveSession(session)
    clearSession('g1')
    expect(getSession('g1')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    localStorage.setItem('gamebooker_session_g1', 'not-json')
    expect(getSession('g1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=session.test
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/reader/session.ts`**

```typescript
import type { Item } from '@/lib/supabase/types'

export interface GameSession {
  gamebookId: string
  currentNodeId: string
  hp: number        // current HP
  maxHp: number     // sila + 10, computed at character creation
  stats: {
    sila: number
    inteligence: number
    obratnost: number
    stesti: number
  }
  inventory: Item[] // full Item objects for offline display
}

const key = (gamebookId: string) => `gamebooker_session_${gamebookId}`

export function getSession(gamebookId: string): GameSession | null {
  try {
    const raw = localStorage.getItem(key(gamebookId))
    return raw ? (JSON.parse(raw) as GameSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: GameSession): void {
  try {
    localStorage.setItem(key(session.gamebookId), JSON.stringify(session))
  } catch {
    // SecurityError or QuotaExceededError — silently ignore
  }
}

export function clearSession(gamebookId: string): void {
  try {
    localStorage.removeItem(key(gamebookId))
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=session.test
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reader/session.ts src/lib/reader/session.test.ts
git commit -m "feat: add reader session localStorage helpers"
```

---

## Task 2: CharacterCreation component

**Files:**
- Create: `src/components/reader/CharacterCreation.tsx`
- Create: `src/components/reader/CharacterCreation.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/reader/CharacterCreation.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CharacterCreation from './CharacterCreation'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockSaveSession = jest.fn()
jest.mock('@/lib/reader/session', () => ({ saveSession: mockSaveSession }))

const baseProps = { gamebookId: 'g1', startNodeId: 'n1', gamebookTitle: 'Lesní dobrodružství' }

beforeEach(() => { mockPush.mockClear(); mockSaveSession.mockClear() })

describe('CharacterCreation', () => {
  it('shows 5 remaining bonus points initially', () => {
    render(<CharacterCreation {...baseProps} />)
    expect(screen.getByText('Zbývá bodů: 5')).toBeInTheDocument()
  })

  it('"Začít hrát" is disabled when pool > 0', () => {
    render(<CharacterCreation {...baseProps} />)
    expect(screen.getByRole('button', { name: /začít hrát/i })).toBeDisabled()
  })

  it('pool decrements when + is clicked', async () => {
    render(<CharacterCreation {...baseProps} />)
    const plusButtons = screen.getAllByText('+')
    await userEvent.click(plusButtons[0]) // add to Síla
    expect(screen.getByText('Zbývá bodů: 4')).toBeInTheDocument()
  })

  it('"Začít hrát" is enabled when pool reaches 0', async () => {
    render(<CharacterCreation {...baseProps} />)
    const plusButtons = screen.getAllByText('+')
    for (let i = 0; i < 5; i++) await userEvent.click(plusButtons[0])
    expect(screen.getByRole('button', { name: /začít hrát/i })).not.toBeDisabled()
  })

  it('saves session and navigates on submit', async () => {
    render(<CharacterCreation {...baseProps} />)
    const plusButtons = screen.getAllByText('+')
    for (let i = 0; i < 5; i++) await userEvent.click(plusButtons[0])
    await userEvent.click(screen.getByRole('button', { name: /začít hrát/i }))
    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({ gamebookId: 'g1', currentNodeId: 'n1' })
    )
    expect(mockPush).toHaveBeenCalledWith('/hrat/g1/uzel/n1')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --testPathPattern=CharacterCreation.test
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/reader/CharacterCreation.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSession } from '@/lib/reader/session'
import type { GameSession } from '@/lib/reader/session'

const POOL = 5
const BASE = 5

const STAT_LABELS: Record<string, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
  stesti: 'Štěstí',
}

type Stats = GameSession['stats']

interface Props {
  gamebookId: string
  startNodeId: string
  gamebookTitle: string
}

export default function CharacterCreation({ gamebookId, startNodeId, gamebookTitle }: Props) {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({ sila: BASE, inteligence: BASE, obratnost: BASE, stesti: BASE })

  const spent = stats.sila + stats.inteligence + stats.obratnost + stats.stesti - BASE * 4
  const pool = POOL - spent

  function add(attr: keyof Stats) {
    if (pool <= 0) return
    setStats((prev) => ({ ...prev, [attr]: prev[attr] + 1 }))
  }

  function remove(attr: keyof Stats) {
    if (stats[attr] <= BASE) return
    setStats((prev) => ({ ...prev, [attr]: prev[attr] - 1 }))
  }

  function handleStart() {
    const maxHp = stats.sila + 10
    const session: GameSession = {
      gamebookId,
      currentNodeId: startNodeId,
      hp: maxHp,
      maxHp,
      stats,
      inventory: [],
    }
    saveSession(session)
    router.push(`/hrat/${gamebookId}/uzel/${startNodeId}`)
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">{gamebookTitle}</h1>
      <p className="text-slate-500 mb-6">Nastav svého hrdinu</p>
      <p className="text-sm font-medium mb-4">Zbývá bodů: {pool}</p>

      <div className="space-y-3 mb-4">
        {(Object.keys(stats) as Array<keyof Stats>).map((attr) => (
          <div key={attr} className="flex items-center justify-between">
            <span className="text-sm font-medium w-32">{STAT_LABELS[attr]}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => remove(attr)}
                disabled={stats[attr] <= BASE}
                className="w-7 h-7 rounded border text-lg leading-none disabled:opacity-40"
              >−</button>
              <span className="w-6 text-center font-mono">{stats[attr]}</span>
              <button
                onClick={() => add(attr)}
                disabled={pool <= 0}
                className="w-7 h-7 rounded border text-lg leading-none disabled:opacity-40"
              >+</button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mb-6">Zdraví: {stats.sila + 10} HP</p>

      <button
        onClick={handleStart}
        disabled={pool !== 0}
        className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50"
      >
        Začít hrát
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=CharacterCreation.test
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/CharacterCreation.tsx src/components/reader/CharacterCreation.test.tsx
git commit -m "feat: add CharacterCreation stat allocation component"
```

---

## Task 3: GameStartClient + start page

**Files:**
- Create: `src/components/reader/GameStartClient.tsx`
- Modify: `src/app/hrat/[id]/page.tsx`

No new tests for `GameStartClient` — it's a thin redirect wrapper that calls `getSession` and `router.replace` on mount; unit-testing it requires complex router mocking with little value over integration testing.

- [ ] **Step 1: Create `src/components/reader/GameStartClient.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/reader/session'
import CharacterCreation from './CharacterCreation'

interface Props {
  gamebookId: string
  gamebookTitle: string
  startNodeId: string | null
}

export default function GameStartClient({ gamebookId, gamebookTitle, startNodeId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const session = getSession(gamebookId)
    if (session) {
      router.replace(`/hrat/${gamebookId}/uzel/${session.currentNodeId}`)
    }
  }, [gamebookId, router])

  if (!startNodeId) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Tento gamebook nemá startovní uzel.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <CharacterCreation
        gamebookId={gamebookId}
        startNodeId={startNodeId}
        gamebookTitle={gamebookTitle}
      />
    </main>
  )
}
```

- [ ] **Step 2: Replace `src/app/hrat/[id]/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Gamebook, Node } from '@/lib/supabase/types'
import GameStartClient from '@/components/reader/GameStartClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HratPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawGamebook }, { data: rawStartNode }] = await Promise.all([
    supabase.from('gamebooks').select('*').eq('id', id).eq('status', 'published').single(),
    supabase.from('nodes').select('id').eq('gamebook_id', id).eq('is_start', true).single(),
  ])

  const gamebook = rawGamebook as Gamebook | null
  if (!gamebook) notFound()

  const startNode = rawStartNode as Pick<Node, 'id'> | null

  return (
    <GameStartClient
      gamebookId={id}
      gamebookTitle={gamebook.title}
      startNodeId={startNode?.id ?? null}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reader/GameStartClient.tsx src/app/hrat/[id]/page.tsx
git commit -m "feat: add GameStartClient and update start page"
```

---

## Task 4: StoryNodeView + EndingView

**Files:**
- Create: `src/components/reader/StoryNodeView.tsx`
- Create: `src/components/reader/StoryNodeView.test.tsx`
- Create: `src/components/reader/EndingView.tsx`
- Create: `src/components/reader/EndingView.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/reader/StoryNodeView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoryNodeView from './StoryNodeView'
import type { Node, Choice } from '@/lib/supabase/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const node: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'story',
  title: 'Lesní cesta', content: 'Jdeš lesem.', summary: '', is_start: true, x: 0, y: 0,
}
const choices: Choice[] = [
  { id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Jít doleva', condition_item_id: null },
  { id: 'c2', from_node_id: 'n1', to_node_id: 'n3', text: 'Jít doprava', condition_item_id: null },
]

beforeEach(() => mockPush.mockClear())

describe('StoryNodeView', () => {
  it('renders title, content and choices', () => {
    render(<StoryNodeView gamebookId="g1" node={node} choices={choices} />)
    expect(screen.getByText('Lesní cesta')).toBeInTheDocument()
    expect(screen.getByText('Jdeš lesem.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jít doleva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jít doprava' })).toBeInTheDocument()
  })

  it('navigates to choice target on click', async () => {
    render(<StoryNodeView gamebookId="g1" node={node} choices={choices} />)
    await userEvent.click(screen.getByRole('button', { name: 'Jít doleva' }))
    expect(mockPush).toHaveBeenCalledWith('/hrat/g1/uzel/n2')
  })
})
```

Create `src/components/reader/EndingView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EndingView from './EndingView'
import type { Node } from '@/lib/supabase/types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockClear = jest.fn()
jest.mock('@/lib/reader/session', () => ({ clearSession: mockClear }))

const node: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'ending',
  title: 'Konec', content: 'Příběh skončil.', summary: '', is_start: false, x: 0, y: 0,
}

beforeEach(() => { mockPush.mockClear(); mockClear.mockClear() })

describe('EndingView', () => {
  it('renders ending title, content and restart button', () => {
    render(<EndingView gamebookId="g1" node={node} />)
    expect(screen.getByText('Konec')).toBeInTheDocument()
    expect(screen.getByText('Příběh skončil.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hrát znovu/i })).toBeInTheDocument()
  })

  it('clears session and redirects to start on restart', async () => {
    render(<EndingView gamebookId="g1" node={node} />)
    await userEvent.click(screen.getByRole('button', { name: /hrát znovu/i }))
    expect(mockClear).toHaveBeenCalledWith('g1')
    expect(mockPush).toHaveBeenCalledWith('/hrat/g1')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --testPathPattern="StoryNodeView.test|EndingView.test"
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/reader/StoryNodeView.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import type { Node, Choice } from '@/lib/supabase/types'

interface Props {
  gamebookId: string
  node: Node
  choices: Choice[]
}

export default function StoryNodeView({ gamebookId, node, choices }: Props) {
  const router = useRouter()

  return (
    <div className="max-w-xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">{node.title}</h2>
      <p className="text-slate-700 whitespace-pre-wrap mb-8 leading-relaxed">{node.content}</p>
      <div className="space-y-3">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => router.push(`/hrat/${gamebookId}/uzel/${choice.to_node_id}`)}
            className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
          >
            {choice.text}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `src/components/reader/EndingView.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { clearSession } from '@/lib/reader/session'
import type { Node } from '@/lib/supabase/types'

interface Props {
  gamebookId: string
  node: Node
}

export default function EndingView({ gamebookId, node }: Props) {
  const router = useRouter()

  function handleRestart() {
    clearSession(gamebookId)
    router.push(`/hrat/${gamebookId}`)
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">{node.title}</h2>
      <p className="text-slate-700 whitespace-pre-wrap mb-8 leading-relaxed">{node.content}</p>
      <button
        onClick={handleRestart}
        className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium"
      >
        Hrát znovu
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="StoryNodeView.test|EndingView.test"
```
Expected: PASS (4 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/components/reader/StoryNodeView.tsx src/components/reader/StoryNodeView.test.tsx
git add src/components/reader/EndingView.tsx src/components/reader/EndingView.test.tsx
git commit -m "feat: add StoryNodeView and EndingView reader components"
```

---

## Task 5: SessionBar + InventoryModal

**Files:**
- Create: `src/components/reader/InventoryModal.tsx`
- Create: `src/components/reader/SessionBar.tsx`
- Create: `src/components/reader/SessionBar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/reader/SessionBar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SessionBar from './SessionBar'
import type { GameSession } from '@/lib/reader/session'

const session: GameSession = {
  gamebookId: 'g1', currentNodeId: 'n1',
  hp: 12, maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

describe('SessionBar', () => {
  it('shows current and max HP', () => {
    render(<SessionBar session={session} />)
    expect(screen.getByText(/zdraví.*12.*15/i)).toBeInTheDocument()
  })

  it('opens inventory modal on button click', async () => {
    render(<SessionBar session={session} />)
    await userEvent.click(screen.getByRole('button', { name: /inventář/i }))
    expect(screen.getByRole('heading', { name: /inventář/i })).toBeInTheDocument()
  })

  it('closes inventory modal on close button', async () => {
    render(<SessionBar session={session} />)
    await userEvent.click(screen.getByRole('button', { name: /inventář/i }))
    await userEvent.click(screen.getByRole('button', { name: /zavřít/i }))
    expect(screen.queryByRole('heading', { name: /inventář/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --testPathPattern=SessionBar.test
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/reader/InventoryModal.tsx`**

```tsx
'use client'

import { X } from 'lucide-react'
import type { Item, StatAttribute } from '@/lib/supabase/types'

const STAT_LABELS: Record<StatAttribute, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
  stesti: 'Štěstí',
}

interface Props {
  items: Item[]
  onClose: () => void
}

export default function InventoryModal({ items, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Inventář</h2>
          <button aria-label="Zavřít" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-slate-400 italic text-sm">Žádné předměty.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-slate-200">
                <p className="font-medium text-sm">{item.name}</p>
                {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                {item.stat_bonus_attribute && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mt-1 inline-block">
                    +{item.stat_bonus_value} {STAT_LABELS[item.stat_bonus_attribute]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `src/components/reader/SessionBar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { GameSession } from '@/lib/reader/session'
import InventoryModal from './InventoryModal'

interface Props {
  session: GameSession
}

export default function SessionBar({ session }: Props) {
  const [showInventory, setShowInventory] = useState(false)

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-40">
        <span className="text-sm font-medium text-slate-700">
          Zdraví: {session.hp} / {session.maxHp}
        </span>
        <button
          onClick={() => setShowInventory(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Inventář ({session.inventory.length})
        </button>
      </div>
      {showInventory && (
        <InventoryModal items={session.inventory} onClose={() => setShowInventory(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=SessionBar.test
```
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/reader/InventoryModal.tsx src/components/reader/SessionBar.tsx src/components/reader/SessionBar.test.tsx
git commit -m "feat: add SessionBar and InventoryModal"
```

---

## Task 6: NodeReader + node page

**Files:**
- Create: `src/components/reader/NodeReader.tsx`
- Create: `src/app/hrat/[id]/uzel/[nodeId]/page.tsx`

No unit tests for `NodeReader` — it's a routing/state coordinator; covered by integration. No test for the server page — it's a data-fetching shell.

- [ ] **Step 1: Create `src/components/reader/NodeReader.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, saveSession } from '@/lib/reader/session'
import type { Node, Choice, Item, CombatConfig } from '@/lib/supabase/types'
import SessionBar from './SessionBar'
import StoryNodeView from './StoryNodeView'
import ItemDiscoveryNodeView from './ItemDiscoveryNodeView'
import CombatView from './CombatView'
import EndingView from './EndingView'

interface Props {
  gamebookId: string
  node: Node
  choices: Choice[]
  combatConfig: CombatConfig | null
  assignedItems: Item[]
}

export default function NodeReader({ gamebookId, node, choices, combatConfig, assignedItems }: Props) {
  const router = useRouter()
  const session = getSession(gamebookId)

  useEffect(() => {
    if (!session) {
      router.replace(`/hrat/${gamebookId}`)
      return
    }
    if (session.currentNodeId !== node.id) {
      saveSession({ ...session, currentNodeId: node.id })
    }
  }, [node.id, gamebookId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null

  return (
    <div className="min-h-screen bg-slate-50 pt-12">
      <SessionBar session={session} />

      {node.type === 'story' && (
        <StoryNodeView gamebookId={gamebookId} node={node} choices={choices} />
      )}

      {node.type === 'item_discovery' && (
        <ItemDiscoveryNodeView
          gamebookId={gamebookId}
          node={node}
          choices={choices}
          assignedItems={assignedItems}
          session={session}
        />
      )}

      {node.type === 'combat' && combatConfig && (
        <CombatView
          gamebookId={gamebookId}
          node={node}
          combatConfig={combatConfig}
          session={session}
        />
      )}

      {node.type === 'ending' && (
        <EndingView gamebookId={gamebookId} node={node} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/hrat/[id]/uzel/[nodeId]/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Node, Choice, Item, NodeItem, CombatConfig } from '@/lib/supabase/types'
import NodeReader from '@/components/reader/NodeReader'

interface Props {
  params: Promise<{ id: string; nodeId: string }>
}

export default async function NodePage({ params }: Props) {
  const { id, nodeId } = await params
  const supabase = await createClient()

  const { data: rawNode } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', nodeId)
    .eq('gamebook_id', id)
    .single()

  const node = rawNode as Node | null
  if (!node) notFound()

  const [
    { data: rawChoices },
    { data: rawCombatConfig },
    { data: rawNodeItems },
  ] = await Promise.all([
    supabase.from('choices').select('*').eq('from_node_id', nodeId),
    node.type === 'combat'
      ? supabase.from('combat_configs').select('*').eq('node_id', nodeId).single()
      : Promise.resolve({ data: null }),
    node.type === 'item_discovery'
      ? supabase.from('node_items').select('*').eq('node_id', nodeId)
      : Promise.resolve({ data: [] }),
  ])

  const choices = (rawChoices as Choice[]) ?? []
  const combatConfig = rawCombatConfig as CombatConfig | null
  const nodeItemIds = ((rawNodeItems as NodeItem[]) ?? []).map((ni) => ni.item_id)

  let assignedItems: Item[] = []
  if (nodeItemIds.length > 0) {
    const { data: rawItems } = await supabase.from('items').select('*').in('id', nodeItemIds)
    assignedItems = (rawItems as Item[]) ?? []
  }

  return (
    <NodeReader
      gamebookId={id}
      node={node}
      choices={choices}
      combatConfig={combatConfig}
      assignedItems={assignedItems}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reader/NodeReader.tsx src/app/hrat/[id]/uzel/[nodeId]/page.tsx
git commit -m "feat: add NodeReader and node page server component"
```

---

## Task 7: ItemDiscoveryNodeView

**Files:**
- Create: `src/components/reader/ItemDiscoveryNodeView.tsx`
- Create: `src/components/reader/ItemDiscoveryNodeView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/reader/ItemDiscoveryNodeView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import ItemDiscoveryNodeView from './ItemDiscoveryNodeView'
import type { Item, Node, Choice } from '@/lib/supabase/types'
import type { GameSession } from '@/lib/reader/session'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
const mockSaveSession = jest.fn()
jest.mock('@/lib/reader/session', () => ({ saveSession: mockSaveSession }))

const item1: Item = { id: 'i1', gamebook_id: 'g1', name: 'Zlatý meč', description: '', stat_bonus_attribute: null, stat_bonus_value: 0 }
const item2: Item = { id: 'i2', gamebook_id: 'g1', name: 'Štít', description: '', stat_bonus_attribute: null, stat_bonus_value: 0 }

const node: Node = { id: 'n1', gamebook_id: 'g1', type: 'item_discovery', title: 'Poklad', content: 'Najdeš truhlu.', summary: '', is_start: false, x: 0, y: 0 }
const choices: Choice[] = [{ id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Pokračovat', condition_item_id: null }]

const emptySession: GameSession = {
  gamebookId: 'g1', currentNodeId: 'n1', hp: 15, maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

beforeEach(() => mockSaveSession.mockClear())

describe('ItemDiscoveryNodeView', () => {
  it('adds new items to session on mount', () => {
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1]} session={emptySession} />)
    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({ inventory: [item1] })
    )
  })

  it('shows toast for each new item', () => {
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1]} session={emptySession} />)
    expect(screen.getByText('Získal jsi: Zlatý meč')).toBeInTheDocument()
  })

  it('skips items already in inventory', () => {
    const sessionWithItem = { ...emptySession, inventory: [item1] }
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1, item2]} session={sessionWithItem} />)
    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({ inventory: [item1, item2] })
    )
    expect(mockSaveSession).toHaveBeenCalledTimes(1)
  })

  it('does not call saveSession when all items already owned', () => {
    const sessionWithItem = { ...emptySession, inventory: [item1] }
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[item1]} session={sessionWithItem} />)
    expect(mockSaveSession).not.toHaveBeenCalled()
  })

  it('renders node content and choices', () => {
    render(<ItemDiscoveryNodeView gamebookId="g1" node={node} choices={choices} assignedItems={[]} session={emptySession} />)
    expect(screen.getByText('Najdeš truhlu.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pokračovat' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --testPathPattern=ItemDiscoveryNodeView.test
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/reader/ItemDiscoveryNodeView.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { saveSession } from '@/lib/reader/session'
import type { GameSession } from '@/lib/reader/session'
import type { Node, Choice, Item } from '@/lib/supabase/types'
import StoryNodeView from './StoryNodeView'

interface Props {
  gamebookId: string
  node: Node
  choices: Choice[]
  assignedItems: Item[]
  session: GameSession
}

export default function ItemDiscoveryNodeView({ gamebookId, node, choices, assignedItems, session }: Props) {
  const [toasts, setToasts] = useState<string[]>([])

  useEffect(() => {
    const ownedIds = new Set(session.inventory.map((i) => i.id))
    const newItems = assignedItems.filter((i) => !ownedIds.has(i.id))
    if (newItems.length === 0) return

    saveSession({ ...session, inventory: [...session.inventory, ...newItems] })
    setToasts(newItems.map((i) => i.name))

    const timer = setTimeout(() => setToasts([]), 3000)
    return () => clearTimeout(timer)
  }, []) // intentionally run once on mount

  return (
    <>
      {toasts.map((name) => (
        <div
          key={name}
          className="fixed top-14 right-4 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow text-sm"
        >
          Získal jsi: {name}
        </div>
      ))}
      <StoryNodeView gamebookId={gamebookId} node={node} choices={choices} />
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=ItemDiscoveryNodeView.test
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/ItemDiscoveryNodeView.tsx src/components/reader/ItemDiscoveryNodeView.test.tsx
git commit -m "feat: add ItemDiscoveryNodeView with auto-pickup and toast"
```

---

## Task 8: CombatView

**Files:**
- Create: `src/components/reader/CombatView.tsx` (exports pure logic functions)
- Create: `src/components/reader/CombatView.test.tsx`

The combat logic (`resolveRound`, `resolveLuck`, `computeItemBonus`) is exported from `CombatView.tsx` and tested as pure functions — no DOM needed for the core mechanics tests.

- [ ] **Step 1: Write the failing tests**

Create `src/components/reader/CombatView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import CombatView, { resolveRound, resolveLuck, computeItemBonus } from './CombatView'
import type { CombatState } from './CombatView'
import type { CombatConfig } from '@/lib/supabase/types'
import type { GameSession } from '@/lib/reader/session'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/reader/session', () => ({ saveSession: jest.fn() }))

// --- Pure function tests ---

const initial: CombatState = {
  playerHp: 15, enemyHp: 10,
  playerRoundWins: 0, enemyRoundWins: 0,
  log: [], phase: 'idle', luckUsed: false, pendingLoss: null,
}

describe('resolveRound', () => {
  it('player wins: reduces enemy HP and increments playerRoundWins', () => {
    const s = resolveRound(initial, 10, 5)
    expect(s.enemyHp).toBe(5)     // 10 - max(1, 10-5)
    expect(s.playerRoundWins).toBe(1)
    expect(s.phase).toBe('idle')
  })

  it('tie: no HP change, no round wins', () => {
    const s = resolveRound(initial, 7, 7)
    expect(s.playerHp).toBe(15)
    expect(s.enemyHp).toBe(10)
    expect(s.playerRoundWins).toBe(0)
    expect(s.enemyRoundWins).toBe(0)
    expect(s.phase).toBe('idle')
  })

  it('player loses: enters luck_prompt with pendingLoss when luck unused', () => {
    const s = resolveRound(initial, 5, 10)
    expect(s.phase).toBe('luck_prompt')
    expect(s.pendingLoss).toEqual({ damage: 5 })
    expect(s.playerHp).toBe(15) // HP not applied yet
  })

  it('player loses: applies HP directly when luck already used', () => {
    const state = { ...initial, luckUsed: true }
    const s = resolveRound(state, 5, 10)
    expect(s.playerHp).toBe(10) // 15 - max(1, 10-5)
    expect(s.enemyRoundWins).toBe(1)
    expect(s.phase).toBe('idle')
  })

  it('damage is at least 1', () => {
    const s = resolveRound(initial, 6, 5) // diff = 1
    expect(s.enemyHp).toBe(9)             // 10 - 1
  })

  it('victory when player reaches 2 round wins', () => {
    const state = { ...initial, playerRoundWins: 1 }
    const s = resolveRound(state, 10, 5)
    expect(s.phase).toBe('victory')
  })

  it('victory when enemy HP reaches 0', () => {
    const state = { ...initial, enemyHp: 3 }
    const s = resolveRound(state, 10, 5)
    expect(s.enemyHp).toBe(0)
    expect(s.phase).toBe('victory')
  })

  it('defeat when enemy reaches 2 round wins (luck used)', () => {
    const state = { ...initial, enemyRoundWins: 1, luckUsed: true }
    const s = resolveRound(state, 5, 10)
    expect(s.phase).toBe('defeat')
  })

  it('defeat when player HP reaches 0 (luck used)', () => {
    const state = { ...initial, playerHp: 3, luckUsed: true }
    const s = resolveRound(state, 5, 10)
    expect(s.playerHp).toBe(0)
    expect(s.phase).toBe('defeat')
  })
})

describe('resolveLuck', () => {
  const stateWithPending: CombatState = {
    ...initial, phase: 'luck_prompt', pendingLoss: { damage: 5 },
  }

  it('roll >= 7: loss becomes draw, no HP applied, luckUsed set', () => {
    const s = resolveLuck(stateWithPending, 7)
    expect(s.playerHp).toBe(15)
    expect(s.enemyRoundWins).toBe(0)
    expect(s.luckUsed).toBe(true)
    expect(s.phase).toBe('idle')
  })

  it('roll < 7: pending loss applied, luckUsed set', () => {
    const s = resolveLuck(stateWithPending, 6)
    expect(s.playerHp).toBe(10) // 15 - 5
    expect(s.enemyRoundWins).toBe(1)
    expect(s.luckUsed).toBe(true)
  })

  it('roll < 7: defeat if applying loss would finish combat', () => {
    const state = { ...stateWithPending, enemyRoundWins: 1 }
    const s = resolveLuck(state, 6)
    expect(s.phase).toBe('defeat')
  })
})

describe('computeItemBonus', () => {
  it('sums bonus values for matching attribute', () => {
    const items = [
      { id: 'i1', gamebook_id: 'g1', name: 'Sword', description: '', stat_bonus_attribute: 'sila' as const, stat_bonus_value: 2 },
      { id: 'i2', gamebook_id: 'g1', name: 'Ring', description: '', stat_bonus_attribute: 'sila' as const, stat_bonus_value: 1 },
      { id: 'i3', gamebook_id: 'g1', name: 'Shield', description: '', stat_bonus_attribute: 'obratnost' as const, stat_bonus_value: 3 },
    ]
    expect(computeItemBonus(items, 'sila')).toBe(3)
    expect(computeItemBonus(items, 'obratnost')).toBe(3)
    expect(computeItemBonus(items, 'inteligence')).toBe(0)
  })
})

// --- Component render tests ---

const baseConfig: CombatConfig = {
  id: 'cc1', node_id: 'n1',
  enemy_name: 'Goblin', enemy_hp: 10,
  enemy_sila: 4, enemy_inteligence: 3, enemy_obratnost: 3, enemy_stesti: 3,
  player_attribute: 'sila', enemy_attribute: 'sila',
  victory_node_id: 'nv', defeat_node_id: 'nd',
}

const baseSession: GameSession = {
  gamebookId: 'g1', currentNodeId: 'n1', hp: 15, maxHp: 15,
  stats: { sila: 5, inteligence: 5, obratnost: 5, stesti: 5 },
  inventory: [],
}

const node = { id: 'n1', gamebook_id: 'g1', type: 'combat' as const, title: 'Souboj', content: 'Goblin útočí.', summary: '', is_start: false, x: 0, y: 0 }

describe('CombatView render', () => {
  it('shows enemy name and roll button in idle phase', () => {
    render(<CombatView gamebookId="g1" node={node} combatConfig={baseConfig} session={baseSession} />)
    expect(screen.getByText('Goblin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hodit kostky/i })).toBeInTheDocument()
  })

  it('shows error when victory_node_id is null', () => {
    const config = { ...baseConfig, victory_node_id: null }
    render(<CombatView gamebookId="g1" node={node} combatConfig={config} session={baseSession} />)
    expect(screen.getByText(/souboj není správně nakonfigurován/i)).toBeInTheDocument()
  })

  it('shows error when defeat_node_id is null', () => {
    const config = { ...baseConfig, defeat_node_id: null }
    render(<CombatView gamebookId="g1" node={node} combatConfig={config} session={baseSession} />)
    expect(screen.getByText(/souboj není správně nakonfigurován/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- --testPathPattern=CombatView.test
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/reader/CombatView.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSession } from '@/lib/reader/session'
import type { GameSession } from '@/lib/reader/session'
import type { Node, CombatConfig, Item, StatAttribute } from '@/lib/supabase/types'

// --- Exported pure functions (tested independently) ---

export interface CombatState {
  playerHp: number
  enemyHp: number
  playerRoundWins: number
  enemyRoundWins: number
  log: string[]
  phase: 'idle' | 'luck_prompt' | 'victory' | 'defeat'
  luckUsed: boolean
  pendingLoss: { damage: number } | null
}

export function computeItemBonus(inventory: Item[], attribute: StatAttribute): number {
  return inventory.reduce(
    (sum, item) => (item.stat_bonus_attribute === attribute ? sum + item.stat_bonus_value : sum),
    0,
  )
}

export function resolveRound(state: CombatState, playerRoll: number, enemyRoll: number): CombatState {
  if (playerRoll === enemyRoll) {
    return { ...state, log: [...state.log, `Remíza (${playerRoll} vs ${enemyRoll})`] }
  }

  if (playerRoll > enemyRoll) {
    const damage = Math.max(1, playerRoll - enemyRoll)
    const newEnemyHp = Math.max(0, state.enemyHp - damage)
    const newWins = state.playerRoundWins + 1
    const phase: CombatState['phase'] = newEnemyHp === 0 || newWins >= 2 ? 'victory' : 'idle'
    return {
      ...state,
      enemyHp: newEnemyHp,
      playerRoundWins: newWins,
      phase,
      log: [...state.log, `Výhra kola — nepřítel −${damage} HP`],
    }
  }

  // Player loses
  const damage = Math.max(1, enemyRoll - playerRoll)
  if (!state.luckUsed) {
    return {
      ...state,
      log: [...state.log, `Prohra kola (možná ztráta ${damage} HP)`],
      phase: 'luck_prompt',
      pendingLoss: { damage },
    }
  }

  const newPlayerHp = Math.max(0, state.playerHp - damage)
  const newWins = state.enemyRoundWins + 1
  const phase: CombatState['phase'] = newPlayerHp === 0 || newWins >= 2 ? 'defeat' : 'idle'
  return {
    ...state,
    playerHp: newPlayerHp,
    enemyRoundWins: newWins,
    phase,
    log: [...state.log, `Prohra kola — ty −${damage} HP`],
  }
}

export function resolveLuck(state: CombatState, luckRoll: number): CombatState {
  if (!state.pendingLoss) return state

  if (luckRoll >= 7) {
    return {
      ...state,
      log: [...state.log, `Štěstí: ${luckRoll} ≥ 7 — prohra se stala remízou!`],
      phase: 'idle',
      pendingLoss: null,
      luckUsed: true,
    }
  }

  const damage = state.pendingLoss.damage
  const newPlayerHp = Math.max(0, state.playerHp - damage)
  const newWins = state.enemyRoundWins + 1
  const phase: CombatState['phase'] = newPlayerHp === 0 || newWins >= 2 ? 'defeat' : 'idle'
  return {
    ...state,
    playerHp: newPlayerHp,
    enemyRoundWins: newWins,
    phase,
    pendingLoss: null,
    luckUsed: true,
    log: [...state.log, `Štěstí: ${luckRoll} < 7 — smůla`],
  }
}

// --- Component ---

interface Props {
  gamebookId: string
  node: Node
  combatConfig: CombatConfig
  session: GameSession
}

function d6() { return Math.floor(Math.random() * 6) + 1 }

const STAT_LABELS: Record<string, string> = {
  sila: 'Síla', inteligence: 'Inteligence', obratnost: 'Obratnost', stesti: 'Štěstí',
}

export default function CombatView({ gamebookId, node, combatConfig, session }: Props) {
  const router = useRouter()

  const [state, setState] = useState<CombatState>({
    playerHp: session.hp,
    enemyHp: combatConfig.enemy_hp,
    playerRoundWins: 0,
    enemyRoundWins: 0,
    log: [],
    phase: 'idle',
    luckUsed: false,
    pendingLoss: null,
  })

  if (!combatConfig.victory_node_id || !combatConfig.defeat_node_id) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <p className="text-red-600">Souboj není správně nakonfigurován.</p>
      </div>
    )
  }

  function handleRoll() {
    const playerStat = session.stats[combatConfig.player_attribute]
    const playerBonus = computeItemBonus(session.inventory, combatConfig.player_attribute as StatAttribute)
    const playerRoll = d6() + playerStat + playerBonus

    const enemyStatKey = `enemy_${combatConfig.enemy_attribute}` as keyof CombatConfig
    const enemyRoll = d6() + (combatConfig[enemyStatKey] as number)

    setState((prev) => resolveRound(prev, playerRoll, enemyRoll))
  }

  function handleTryLuck() {
    const stestiBonus = computeItemBonus(session.inventory, 'stesti')
    const luckRoll = d6() + session.stats.stesti + stestiBonus
    setState((prev) => resolveLuck(prev, luckRoll))
  }

  function handleSkipLuck() {
    setState((prev) => {
      if (!prev.pendingLoss) return prev
      const damage = prev.pendingLoss.damage
      const newPlayerHp = Math.max(0, prev.playerHp - damage)
      const newWins = prev.enemyRoundWins + 1
      const phase: CombatState['phase'] = newPlayerHp === 0 || newWins >= 2 ? 'defeat' : 'idle'
      return {
        ...prev,
        playerHp: newPlayerHp,
        enemyRoundWins: newWins,
        phase,
        pendingLoss: null,
        log: [...prev.log, `Ztraceno ${damage} HP`],
      }
    })
  }

  function handleContinue() {
    saveSession({ ...session, hp: state.playerHp })
    const targetId = state.phase === 'victory'
      ? combatConfig.victory_node_id!
      : combatConfig.defeat_node_id!
    router.push(`/hrat/${gamebookId}/uzel/${targetId}`)
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">{node.title}</h2>
        <p className="text-slate-600 text-sm">{node.content}</p>
      </div>

      {/* HP bars */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <p className="text-xs text-slate-500 mb-1">Ty</p>
          <p className="font-bold text-lg">{state.playerHp} HP</p>
          <p className="text-xs text-slate-400">{state.playerRoundWins} kol vyhráno</p>
        </div>
        <div className="p-3 rounded-lg border border-red-200 bg-red-50">
          <p className="text-xs text-slate-500 mb-1">{combatConfig.enemy_name}</p>
          <p className="font-bold text-lg">{state.enemyHp} HP</p>
          <p className="text-xs text-slate-400">{state.enemyRoundWins} kol vyhráno</p>
        </div>
      </div>

      {/* Combat log */}
      {state.log.length > 0 && (
        <ul className="text-sm text-slate-600 space-y-1 border-l-2 border-slate-200 pl-3">
          {state.log.map((entry, i) => <li key={i}>{entry}</li>)}
        </ul>
      )}

      {/* Actions */}
      {state.phase === 'idle' && (
        <button
          onClick={handleRoll}
          className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium"
        >
          Hodit kostky
        </button>
      )}

      {state.phase === 'luck_prompt' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Prohráváš kolo. Zkusíš štěstí? ({STAT_LABELS.stesti}: {session.stats.stesti})
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTryLuck}
              className="py-2 rounded-lg bg-amber-500 text-white font-medium text-sm"
            >
              Zkusit štěstí
            </button>
            <button
              onClick={handleSkipLuck}
              className="py-2 rounded-lg border border-slate-300 text-sm"
            >
              Přeskočit
            </button>
          </div>
        </div>
      )}

      {(state.phase === 'victory' || state.phase === 'defeat') && (
        <div className="space-y-3">
          <p className={`font-bold text-lg ${state.phase === 'victory' ? 'text-emerald-600' : 'text-red-600'}`}>
            {state.phase === 'victory' ? '⚔️ Vítězství!' : '💀 Prohra'}
          </p>
          <button
            onClick={handleContinue}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium"
          >
            Pokračovat
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=CombatView.test
```
Expected: PASS (all tests).

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/reader/CombatView.tsx src/components/reader/CombatView.test.tsx
git commit -m "feat: add CombatView with best-of-3 combat system"
```

---

## Task 9: Build verification

- [ ] **Step 1: Run full test suite one final time**

```bash
npm test
```
Expected: all tests pass with no failures.

- [ ] **Step 2: Production build**

```bash
npm run build
```
Expected: build succeeds with no TypeScript errors or missing module errors.

- [ ] **Step 3: If build fails — fix TypeScript errors, then re-run build**

Common issues:
- Missing `'use client'` directive on client components
- Server component importing client-only hooks
- Type mismatches in Supabase `as` casts — use same pattern as `tvorit/[id]/page.tsx`

- [ ] **Step 4: Final commit if any fixes were made**

```bash
git add -p
git commit -m "fix: resolve build errors"
```
