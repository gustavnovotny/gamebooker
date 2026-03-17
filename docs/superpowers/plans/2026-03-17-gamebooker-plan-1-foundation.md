# Gamebooker — Plan 1: Foundation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js project, Supabase database schema, creator authentication, public gamebook library page, and route shells — producing a deployable app skeleton that Plans 2 and 3 build on.

**Architecture:** Next.js 15 App Router with TypeScript. Supabase handles PostgreSQL and creator auth. All creator routes (`/tvorit/*`) are protected by middleware. The public library page (`/`) server-renders published gamebooks via Supabase server client.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth), Vercel deployment, Jest + React Testing Library for tests.

---

## File Map

```
(repo root)
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout: fonts, metadata, Supabase session provider
│   │   ├── page.tsx                        # Public library: server component, fetches published gamebooks
│   │   ├── prihlasit/
│   │   │   └── page.tsx                    # Creator login page
│   │   ├── tvorit/
│   │   │   ├── layout.tsx                  # Protected layout: redirects unauthenticated users
│   │   │   └── page.tsx                    # Creator dashboard shell (Plan 2 fills this out)
│   │   └── hrat/
│   │       └── [id]/
│   │           └── page.tsx                # Gamebook play page shell (Plan 3 fills this out)
│   ├── components/
│   │   ├── library/
│   │   │   ├── GamebookCard.tsx            # Card: cover, title, creator, genre, node count, play button
│   │   │   └── GamebookCard.test.tsx       # Unit tests
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx               # Email + password form, calls Supabase signIn
│   │   │   └── LoginForm.test.tsx          # Unit tests
│   │   └── ui/                             # shadcn/ui components (auto-generated, do not edit)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser Supabase client (createBrowserClient)
│   │   │   ├── server.ts                   # Server Supabase client (createServerClient)
│   │   │   └── types.ts                    # TypeScript types matching DB schema
│   │   ├── utils.ts                        # Shared utilities (cn(), formatDate(), etc.)
│   │   └── utils.test.ts                   # Unit tests for utilities
│   └── middleware.ts                       # Protects /tvorit/* routes, refreshes auth session
├── supabase/
│   └── migrations/
│       └── 20260317001_initial_schema.sql  # All tables + RLS policies
├── jest.config.ts
├── jest.setup.ts
├── .env.local                              # Local env vars (gitignored)
└── next.config.ts
```

---

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (via create-next-app)

- [ ] **Step 1.1: Scaffold the project**

From the repo root (which already has `CLAUDE.md` and `docs/`). Run:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

When prompted "Would you like to use the default project template?", choose **Yes**. When asked about the existing directory, choose **Yes** to proceed.

- [ ] **Step 1.2: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 1.3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: Style = **Default**, Base color = **Slate**, CSS variables = **Yes**.

- [ ] **Step 1.4: Install core shadcn/ui components**

```bash
npx shadcn@latest add button card badge input label
```

- [ ] **Step 1.5: Install test dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event ts-jest
```

- [ ] **Step 1.6: Create jest config**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 1.7: Add test script to package.json**

In `package.json`, add to `scripts`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 1.8: Verify test runner works**

```bash
npm test -- --passWithNoTests
```

Expected: PASS (no tests yet, but runner initialises correctly)

- [ ] **Step 1.9: Commit**

```bash
git add -A
git commit -m "feat: initialise Next.js 15 project with Supabase and shadcn/ui"
```

---

### Task 2: Database schema

**Files:**
- Create: `supabase/migrations/20260317001_initial_schema.sql`

- [ ] **Step 2.1: Create the migration file**

Create `supabase/migrations/20260317001_initial_schema.sql`:

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- GAMEBOOKS
-- ─────────────────────────────────────────────
create table gamebooks (
  id                   uuid primary key default uuid_generate_v4(),
  creator_id           uuid not null references auth.users(id) on delete cascade,
  creator_display_name text not null,
  title                text not null,
  description          text default '',
  cover_image_url      text,
  genre                text,
  status               text not null default 'draft'
                         check (status in ('draft', 'published')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ITEMS  (defined before choices to avoid forward-reference)
-- ─────────────────────────────────────────────
create table items (
  id                   uuid primary key default uuid_generate_v4(),
  gamebook_id          uuid not null references gamebooks(id) on delete cascade,
  name                 text not null,
  description          text default '',
  stat_bonus_attribute text check (stat_bonus_attribute in
                         ('sila', 'inteligence', 'obratnost', 'stesti')),
  stat_bonus_value     int not null default 0
);

-- ─────────────────────────────────────────────
-- NODES
-- ─────────────────────────────────────────────
create table nodes (
  id          uuid primary key default uuid_generate_v4(),
  gamebook_id uuid not null references gamebooks(id) on delete cascade,
  type        text not null check (type in
                ('story', 'combat', 'item_discovery', 'ending')),
  title       text not null,
  content     text not null default '',
  is_start    boolean not null default false,
  x           float not null default 0,
  y           float not null default 0
);

-- ─────────────────────────────────────────────
-- CHOICES
-- ─────────────────────────────────────────────
create table choices (
  id                 uuid primary key default uuid_generate_v4(),
  from_node_id       uuid not null references nodes(id) on delete cascade,
  to_node_id         uuid not null references nodes(id) on delete cascade,
  text               text not null,
  condition_item_id  uuid references items(id) on delete set null
);

-- ─────────────────────────────────────────────
-- NODE ITEMS (junction: items found at a node)
-- ─────────────────────────────────────────────
create table node_items (
  node_id uuid not null references nodes(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  primary key (node_id, item_id)
);

-- ─────────────────────────────────────────────
-- COMBAT CONFIGS
-- ─────────────────────────────────────────────
create table combat_configs (
  id               uuid primary key default uuid_generate_v4(),
  node_id          uuid not null unique references nodes(id) on delete cascade,
  enemy_name       text not null,
  enemy_sila       int not null default 5,
  enemy_inteligence int not null default 5,
  enemy_obratnost  int not null default 5,
  enemy_stesti     int not null default 5,
  enemy_hp         int not null default 15,
  player_attribute text not null
                     check (player_attribute in ('sila', 'inteligence', 'obratnost')),
  enemy_attribute  text not null
                     check (enemy_attribute in ('sila', 'inteligence', 'obratnost')),
  victory_node_id  uuid references nodes(id) on delete set null,
  defeat_node_id   uuid references nodes(id) on delete set null
);

-- ─────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gamebooks_updated_at
  before update on gamebooks
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table gamebooks     enable row level security;
alter table nodes         enable row level security;
alter table choices       enable row level security;
alter table items         enable row level security;
alter table node_items    enable row level security;
alter table combat_configs enable row level security;

-- gamebooks: public read of published; creator full access
create policy "Public can view published gamebooks"
  on gamebooks for select
  using (status = 'published');

create policy "Creators manage own gamebooks"
  on gamebooks for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- nodes: public read if gamebook published; creator full access
create policy "Public can view nodes of published gamebooks"
  on nodes for select
  using (
    exists (
      select 1 from gamebooks g
      where g.id = nodes.gamebook_id and g.status = 'published'
    )
  );

create policy "Creators manage nodes of own gamebooks"
  on nodes for all
  using (
    exists (
      select 1 from gamebooks g
      where g.id = nodes.gamebook_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from gamebooks g
      where g.id = nodes.gamebook_id and g.creator_id = auth.uid()
    )
  );

-- choices: same pattern as nodes
create policy "Public can view choices of published gamebooks"
  on choices for select
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = choices.from_node_id and g.status = 'published'
    )
  );

create policy "Creators manage choices of own gamebooks"
  on choices for all
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = choices.from_node_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = choices.from_node_id and g.creator_id = auth.uid()
    )
  );

-- items: same pattern
create policy "Public can view items of published gamebooks"
  on items for select
  using (
    exists (
      select 1 from gamebooks g
      where g.id = items.gamebook_id and g.status = 'published'
    )
  );

create policy "Creators manage items of own gamebooks"
  on items for all
  using (
    exists (
      select 1 from gamebooks g
      where g.id = items.gamebook_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from gamebooks g
      where g.id = items.gamebook_id and g.creator_id = auth.uid()
    )
  );

-- node_items: same pattern
create policy "Public can view node_items of published gamebooks"
  on node_items for select
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = node_items.node_id and g.status = 'published'
    )
  );

create policy "Creators manage node_items of own gamebooks"
  on node_items for all
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = node_items.node_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = node_items.node_id and g.creator_id = auth.uid()
    )
  );

-- combat_configs: same pattern
create policy "Public can view combat_configs of published gamebooks"
  on combat_configs for select
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = combat_configs.node_id and g.status = 'published'
    )
  );

create policy "Creators manage combat_configs of own gamebooks"
  on combat_configs for all
  using (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = combat_configs.node_id and g.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from nodes n
      join gamebooks g on g.id = n.gamebook_id
      where n.id = combat_configs.node_id and g.creator_id = auth.uid()
    )
  );
```

- [ ] **Step 2.2: Create a Supabase project**

Go to [supabase.com](https://supabase.com), create a new project named `gamebooker`. Save the **Project URL** and **anon key** from Project Settings → API.

- [ ] **Step 2.3: Run the migration**

In the Supabase dashboard: SQL Editor → New query → paste the migration SQL → Run.

Verify: all 6 tables appear in Table Editor.

- [ ] **Step 2.4: Create .env.local**

Create `.env.local` in the repo root (this file is gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Replace values from Supabase dashboard → Project Settings → API.

- [ ] **Step 2.5: Commit migration file**

```bash
git add supabase/
git commit -m "feat: add initial database schema with RLS policies"
```

---

### Task 3: Supabase client setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/types.ts`

- [ ] **Step 3.1: Create TypeScript database types**

Create `src/lib/supabase/types.ts`:

```typescript
export type NodeType = 'story' | 'combat' | 'item_discovery' | 'ending'
export type GamebookStatus = 'draft' | 'published'
export type StatAttribute = 'sila' | 'inteligence' | 'obratnost' | 'stesti'
export type CombatAttribute = 'sila' | 'inteligence' | 'obratnost'

export interface Gamebook {
  id: string
  creator_id: string
  creator_display_name: string
  title: string
  description: string
  cover_image_url: string | null
  genre: string | null
  status: GamebookStatus
  created_at: string
  updated_at: string
}

export interface Node {
  id: string
  gamebook_id: string
  type: NodeType
  title: string
  content: string
  is_start: boolean
  x: number
  y: number
}

export interface Choice {
  id: string
  from_node_id: string
  to_node_id: string
  text: string
  condition_item_id: string | null
}

export interface Item {
  id: string
  gamebook_id: string
  name: string
  description: string
  stat_bonus_attribute: StatAttribute | null
  stat_bonus_value: number
}

export interface NodeItem {
  node_id: string
  item_id: string
}

export interface CombatConfig {
  id: string
  node_id: string
  enemy_name: string
  enemy_sila: number
  enemy_inteligence: number
  enemy_obratnost: number
  enemy_stesti: number
  enemy_hp: number
  player_attribute: CombatAttribute
  enemy_attribute: CombatAttribute
  victory_node_id: string | null
  defeat_node_id: string | null
}

export interface Database {
  public: {
    Tables: {
      gamebooks: { Row: Gamebook; Insert: Omit<Gamebook, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Gamebook, 'id'>> }
      nodes: { Row: Node; Insert: Omit<Node, 'id'>; Update: Partial<Omit<Node, 'id'>> }
      choices: { Row: Choice; Insert: Omit<Choice, 'id'>; Update: Partial<Omit<Choice, 'id'>> }
      items: { Row: Item; Insert: Omit<Item, 'id'>; Update: Partial<Omit<Item, 'id'>> }
      node_items: { Row: NodeItem; Insert: NodeItem; Update: NodeItem }
      combat_configs: { Row: CombatConfig; Insert: Omit<CombatConfig, 'id'>; Update: Partial<Omit<CombatConfig, 'id'>> }
    }
  }
}
```

- [ ] **Step 3.2: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3.3: Create server Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookie writes are handled by middleware
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client setup with TypeScript types"
```

---

### Task 4: Utility functions

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/lib/utils.test.ts`

- [ ] **Step 4.1: Write failing tests**

Create `src/lib/utils.test.ts`:

```typescript
import { cn, formatDate, truncate } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })
})

describe('formatDate', () => {
  it('formats ISO date to Czech locale', () => {
    const result = formatDate('2026-03-17T12:00:00Z')
    expect(result).toMatch(/17/)
    expect(result).toMatch(/2026/)
  })
})

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello…')
  })
})
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
npm test src/lib/utils.test.ts
```

Expected: FAIL — `Cannot find module './utils'`

- [ ] **Step 4.3: Implement utils**

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
npm test src/lib/utils.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add utility functions (cn, formatDate, truncate)"
```

---

### Task 5: Auth middleware + protected layout

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/tvorit/layout.tsx`

- [ ] **Step 5.1: Create auth middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/tvorit')

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/prihlasit'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 5.2: Create protected layout for /tvorit**

Create `src/app/tvorit/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function TvoritLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/prihlasit')
  }

  return <>{children}</>
}
```

- [ ] **Step 5.3: Manually verify middleware works**

Start dev server: `npm run dev`

Navigate to `http://localhost:3000/tvorit` — should redirect to `/prihlasit`.

- [ ] **Step 5.4: Commit**

```bash
git add src/middleware.ts src/app/tvorit/layout.tsx
git commit -m "feat: add auth middleware protecting /tvorit routes"
```

---

### Task 6: Creator login page

**Files:**
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/components/auth/LoginForm.test.tsx`
- Create: `src/app/prihlasit/page.tsx`

- [ ] **Step 6.1: Write failing LoginForm tests**

Create `src/components/auth/LoginForm.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from './LoginForm'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/heslo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /přihlásit/i })).toBeInTheDocument()
  })

  it('shows error when fields are empty and form is submitted', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /přihlásit/i }))
    expect(screen.getByText(/vyplňte e-mail/i)).toBeInTheDocument()
  })

  it('shows error message when Supabase returns an error', async () => {
    const { createClient } = require('@/lib/supabase/client')
    createClient.mockReturnValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' },
        }),
      },
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/heslo/i), 'wrongpassword')
    await userEvent.click(screen.getByRole('button', { name: /přihlásit/i }))

    expect(await screen.findByText(/nesprávný e-mail nebo heslo/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2: Run tests to verify they fail**

```bash
npm test src/components/auth/LoginForm.test.tsx
```

Expected: FAIL — `Cannot find module './LoginForm'`

- [ ] **Step 6.3: Implement LoginForm**

Create `src/components/auth/LoginForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email) {
      setError('Vyplňte e-mail a heslo.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nesprávný e-mail nebo heslo.')
      setLoading(false)
      return
    }

    router.push('/tvorit')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vas@email.cz"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Heslo</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Přihlašování…' : 'Přihlásit se'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

```bash
npm test src/components/auth/LoginForm.test.tsx
```

Expected: PASS — 3 tests passing

- [ ] **Step 6.5: Create login page**

Create `src/app/prihlasit/page.tsx`:

```typescript
import LoginForm from '@/components/auth/LoginForm'

export const metadata = { title: 'Přihlášení — Gamebooker' }

export default function PrihlasitPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-2xl shadow-sm border">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Gamebooker</h1>
          <p className="text-slate-500 text-sm">Přihlaste se jako tvůrce</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 6.6: Create a test creator account**

In Supabase dashboard → Authentication → Users → Add user. Use your own email and a test password.

- [ ] **Step 6.7: Manually test login flow**

Navigate to `http://localhost:3000/prihlasit`. Log in with test credentials. Verify redirect to `/tvorit`.

- [ ] **Step 6.8: Commit**

```bash
git add src/components/auth/ src/app/prihlasit/
git commit -m "feat: add creator login page with email/password auth"
```

---

### Task 7: Public library page (GamebookCard + landing page)

**Files:**
- Create: `src/components/library/GamebookCard.tsx`
- Create: `src/components/library/GamebookCard.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 7.1: Write failing GamebookCard tests**

Create `src/components/library/GamebookCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import GamebookCard from './GamebookCard'
import type { Gamebook } from '@/lib/supabase/types'

const mockGamebook: Gamebook = {
  id: 'abc-123',
  creator_id: 'user-1',
  creator_display_name: 'Jana Nováková',
  title: 'Záhadný hrad',
  description: 'Příběh o starém hradě plném tajemství.',
  cover_image_url: null,
  genre: 'Fantasy',
  status: 'published',
  created_at: '2026-03-17T10:00:00Z',
  updated_at: '2026-03-17T10:00:00Z',
}

describe('GamebookCard', () => {
  it('renders gamebook title', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText('Záhadný hrad')).toBeInTheDocument()
  })

  it('renders creator name', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText('Jana Nováková')).toBeInTheDocument()
  })

  it('renders genre badge', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText('Fantasy')).toBeInTheDocument()
  })

  it('renders node count', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByText(/12 uzlů/i)).toBeInTheDocument()
  })

  it('renders a play link to the correct URL', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    const link = screen.getByRole('link', { name: /hrát/i })
    expect(link).toHaveAttribute('href', '/hrat/abc-123')
  })

  it('renders fallback when no cover image', () => {
    render(<GamebookCard gamebook={mockGamebook} nodeCount={12} />)
    expect(screen.getByTestId('cover-placeholder')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
npm test src/components/library/GamebookCard.test.tsx
```

Expected: FAIL — `Cannot find module './GamebookCard'`

- [ ] **Step 7.3: Implement GamebookCard**

Create `src/components/library/GamebookCard.tsx`:

```typescript
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import type { Gamebook } from '@/lib/supabase/types'
import { BookOpen } from 'lucide-react'

interface GamebookCardProps {
  gamebook: Gamebook
  nodeCount: number
}

export default function GamebookCard({ gamebook, nodeCount }: GamebookCardProps) {
  return (
    <Card className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Cover image */}
      <div className="relative aspect-[3/2] bg-indigo-50">
        {gamebook.cover_image_url ? (
          <Image
            src={gamebook.cover_image_url}
            alt={gamebook.title}
            fill
            className="object-cover"
          />
        ) : (
          <div
            data-testid="cover-placeholder"
            className="absolute inset-0 flex items-center justify-center"
          >
            <BookOpen className="w-12 h-12 text-indigo-200" />
          </div>
        )}
      </div>

      <CardContent className="flex-1 pt-4 space-y-2">
        {gamebook.genre && (
          <Badge variant="secondary" className="text-xs">
            {gamebook.genre}
          </Badge>
        )}
        <h2 className="font-bold text-slate-900 line-clamp-2 leading-snug">
          {gamebook.title}
        </h2>
        <p className="text-sm text-slate-500 line-clamp-2">{gamebook.description}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{gamebook.creator_display_name}</span>
          <span>·</span>
          <span>{nodeCount} uzlů</span>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild className="w-full" size="sm">
          <Link href={`/hrat/${gamebook.id}`}>Hrát</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```bash
npm test src/components/library/GamebookCard.test.tsx
```

Expected: PASS — 6 tests passing

- [ ] **Step 7.5: Implement library page (server component)**

Replace `src/app/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import GamebookCard from '@/components/library/GamebookCard'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Gamebooker — Čti a hraj gamebooky' }

export default async function LibraryPage() {
  const supabase = await createClient()

  // Fetch published gamebooks with node counts
  const { data: gamebooks } = await supabase
    .from('gamebooks')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // Fetch node counts for all published gamebooks
  const nodeCounts: Record<string, number> = {}
  if (gamebooks && gamebooks.length > 0) {
    const { data: counts } = await supabase
      .from('nodes')
      .select('gamebook_id')
      .in('gamebook_id', gamebooks.map((g) => g.id))

    counts?.forEach(({ gamebook_id }) => {
      nodeCounts[gamebook_id] = (nodeCounts[gamebook_id] ?? 0) + 1
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg text-slate-900">Gamebooker</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/prihlasit">Přihlásit se jako tvůrce</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-4xl font-bold text-slate-900">
          Čti a hraj gamebooky
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Interaktivní příběhy, kde ty rozhoduješ. Vytvoř vlastní nebo si zaehraj ty od ostatních.
        </p>
      </section>

      {/* Library grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        {!gamebooks || gamebooks.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Zatím žádné gamebooky. Buď první!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {gamebooks.map((gamebook) => (
              <GamebookCard
                key={gamebook.id}
                gamebook={gamebook}
                nodeCount={nodeCounts[gamebook.id] ?? 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 7.6: Manually verify library page**

Navigate to `http://localhost:3000`. Should show the library header, hero, and empty state.

- [ ] **Step 7.7: Commit**

```bash
git add src/components/library/ src/app/page.tsx
git commit -m "feat: add public library page with GamebookCard component"
```

---

### Task 8: Route shells + layout

**Files:**
- Create: `src/app/tvorit/page.tsx`
- Create: `src/app/hrat/[id]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 8.1: Update root layout with fonts and metadata**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

export const metadata: Metadata = {
  title: 'Gamebooker',
  description: 'Vytvárej, sdílej a hraj interaktivní gamebooky v češtině.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8.2: Create creator dashboard shell**

Create `src/app/tvorit/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Moje gamebooky — Gamebooker' }

export default async function TvoritPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900">Moje gamebooky</h1>
      <p className="text-slate-500 mt-1">Přihlášen jako {user?.email}</p>
      {/* Plan 2 fills this out */}
    </main>
  )
}
```

- [ ] **Step 8.3: Create gamebook play page shell**

Create `src/app/hrat/[id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

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

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold">{gamebook.title}</h1>
      <p className="text-slate-500">{gamebook.description}</p>
      {/* Plan 3 fills this out */}
    </main>
  )
}
```

- [ ] **Step 8.4: Manually test all routes**

- `http://localhost:3000/` — library page ✓
- `http://localhost:3000/prihlasit` — login form ✓
- `http://localhost:3000/tvorit` — redirects to login if not authenticated ✓
- `http://localhost:3000/hrat/nonexistent-id` — 404 ✓

- [ ] **Step 8.5: Run all tests**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 8.6: Final commit**

```bash
git add src/app/
git commit -m "feat: add creator dashboard shell and gamebook play page shell"
```

---

### Task 9: Deploy to Vercel

**Files:** None (configuration done in Vercel dashboard)

- [ ] **Step 9.1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/gamebooker.git
git push -u origin master:main
```

Note: the local branch is `master`; pushing to `main` on GitHub ensures Vercel's default production branch setting works correctly.

- [ ] **Step 9.2: Connect to Vercel**

Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → select `gamebooker`.

- [ ] **Step 9.3: Set environment variables in Vercel**

In Project Settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL      = (from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_ANON_KEY = (from Supabase dashboard)
SUPABASE_SERVICE_ROLE_KEY     = (from Supabase dashboard)
```

- [ ] **Step 9.4: Deploy**

Click "Deploy". Wait for build to complete (~2 minutes).

- [ ] **Step 9.5: Verify production deployment**

Open the Vercel URL. Verify:
- Library page loads ✓
- Login page loads ✓
- `/tvorit` redirects to `/prihlasit` ✓

- [ ] **Step 9.6: Add Vercel domain to Supabase allowed URLs**

In Supabase dashboard → Authentication → URL Configuration → add your Vercel URL to **Site URL** and **Redirect URLs**.

---

## What Plan 2 builds on this

Plan 2 (Creator) fills in:
- `src/app/tvorit/page.tsx` — full creator dashboard with gamebook list
- `src/app/tvorit/[id]/page.tsx` — node graph editor
- `src/lib/llm/` — LLM provider abstraction

## What Plan 3 builds on this

Plan 3 (Reader) fills in:
- `src/app/hrat/[id]/page.tsx` — full character creation + reading mode
- `src/components/reader/` — reading interface, inventory, combat system
