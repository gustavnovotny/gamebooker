# Gamebooker — Plan 2: Creator Tools

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full creator experience — a dashboard to manage gamebooks, a node graph editor, and AI-powered brainstorming and text generation — so a creator can go from idea to a complete published gamebook.

**Architecture:** Creator routes are server-rendered where possible for auth; the node graph editor is a client-side React component (React Flow). AI calls go through Next.js API routes that delegate to a provider-agnostic LLM abstraction. All DB mutations use Supabase from client-side via Row Level Security.

**Tech Stack:** Next.js 15 App Router, React Flow, Supabase JS client, provider-agnostic LLM layer (Anthropic / OpenAI), Zod for AI response validation, shadcn/ui components.

**Prerequisite:** Plan 1 (Foundation) must be complete and deployed.

---

## File Map

```
src/
├── app/
│   ├── tvorit/
│   │   ├── page.tsx                              # Creator dashboard (fill in Plan 1 shell)
│   │   └── [id]/
│   │       └── page.tsx                          # Gamebook editor page
│   └── api/
│       └── ai/
│           ├── brainstorm/route.ts               # POST: conversational brainstorm turn
│           ├── generate-outline/route.ts         # POST: story foundation → node graph JSON
│           └── generate-node-text/route.ts       # POST: generate text for one node (streaming)
├── components/
│   ├── creator/
│   │   ├── dashboard/
│   │   │   ├── GamebookList.tsx                  # List of creator's gamebooks
│   │   │   ├── GamebookList.test.tsx
│   │   │   ├── CreateGamebookButton.tsx          # Opens create-gamebook dialog
│   │   │   └── CreateGamebookButton.test.tsx
│   │   ├── editor/
│   │   │   ├── GamebookEditor.tsx                # Root editor component (client)
│   │   │   ├── NodeGraph.tsx                     # React Flow canvas
│   │   │   ├── NodeGraph.test.tsx
│   │   │   ├── NodeDetailPanel.tsx               # Right panel: node content + config
│   │   │   ├── NodeDetailPanel.test.tsx
│   │   │   ├── CombatConfigForm.tsx              # Combat node configuration
│   │   │   ├── CombatConfigForm.test.tsx
│   │   │   ├── ItemSelector.tsx                  # Add/remove items on a node
│   │   │   └── PublishButton.tsx                 # Validates + publishes gamebook
│   │   └── ai/
│   │       ├── BrainstormChat.tsx                # Phase 1: AI conversation
│   │       ├── BrainstormChat.test.tsx
│   │       ├── StoryFoundationCard.tsx           # Editable story foundation
│   │       └── GenerateTextButton.tsx            # Trigger AI text generation for a node
├── lib/
│   ├── llm/
│   │   ├── types.ts                              # LLMProvider interface + Message type
│   │   ├── anthropic.ts                          # AnthropicProvider implementation
│   │   ├── openai.ts                             # OpenAIProvider implementation
│   │   ├── factory.ts                            # getProvider() reads env vars
│   │   ├── factory.test.ts
│   │   └── prompts/
│   │       ├── brainstorm-conversation.ts        # System prompt: brainstorm phase
│   │       ├── generate-outline.ts               # System prompt: outline generation
│   │       └── generate-node-text.ts             # System prompt: node text generation
│   └── validation/
│       ├── gamebook-validator.ts                 # Pre-publish validation logic
│       └── gamebook-validator.test.ts
```

---

### Task 1: LLM provider abstraction

**Files:**
- Create: `src/lib/llm/types.ts`
- Create: `src/lib/llm/anthropic.ts`
- Create: `src/lib/llm/openai.ts`
- Create: `src/lib/llm/factory.ts`
- Create: `src/lib/llm/factory.test.ts`

- [ ] **Step 1.1: Write failing factory tests**

Create `src/lib/llm/factory.test.ts`:

```typescript
// Mock the provider modules so we don't need real API keys
jest.mock('./anthropic', () => ({
  AnthropicProvider: jest.fn().mockImplementation(() => ({ type: 'anthropic' })),
}))
jest.mock('./openai', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({ type: 'openai' })),
}))

describe('getProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.resetModules()
  })

  it('returns AnthropicProvider when LLM_PROVIDER=anthropic', () => {
    process.env.LLM_PROVIDER = 'anthropic'
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_MODEL = 'claude-sonnet-4-6'
    const { getProvider } = require('./factory')
    const provider = getProvider()
    expect(provider.type).toBe('anthropic')
  })

  it('returns OpenAIProvider when LLM_PROVIDER=openai', () => {
    process.env.LLM_PROVIDER = 'openai'
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_MODEL = 'gpt-4o'
    const { getProvider } = require('./factory')
    const provider = getProvider()
    expect(provider.type).toBe('openai')
  })

  it('throws when LLM_PROVIDER is missing', () => {
    delete process.env.LLM_PROVIDER
    const { getProvider } = require('./factory')
    expect(() => getProvider()).toThrow(/LLM_PROVIDER/)
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npm test src/lib/llm/factory.test.ts
```

Expected: FAIL — `Cannot find module './factory'`

- [ ] **Step 1.3: Create LLM types**

Create `src/lib/llm/types.ts`:

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
}

export interface LLMProvider {
  chat(messages: Message[], options?: LLMOptions): Promise<string>
  stream(messages: Message[], options?: LLMOptions): AsyncGenerator<string>
}
```

- [ ] **Step 1.4: Create AnthropicProvider**

Create `src/lib/llm/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, LLMOptions, Message } from './types'

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async chat(messages: Message[], options: LLMOptions = {}): Promise<string> {
    const systemMessage = messages.find((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }

  async *stream(messages: Message[], options: LLMOptions = {}): AsyncGenerator<string> {
    const systemMessage = messages.find((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      system: systemMessage?.content,
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text
      }
    }
  }
}
```

Install the Anthropic SDK:

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 1.5: Create OpenAIProvider**

Create `src/lib/llm/openai.ts`:

```typescript
import OpenAI from 'openai'
import type { LLMProvider, LLMOptions, Message } from './types'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async chat(messages: Message[], options: LLMOptions = {}): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    return response.choices[0]?.message.content ?? ''
  }

  async *stream(messages: Message[], options: LLMOptions = {}): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta.content
      if (text) yield text
    }
  }
}
```

Install the OpenAI SDK:

```bash
npm install openai
```

- [ ] **Step 1.6: Create factory**

Create `src/lib/llm/factory.ts`:

```typescript
import type { LLMProvider } from './types'

export function getProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL

  if (!provider) throw new Error('LLM_PROVIDER environment variable is required')
  if (!apiKey) throw new Error('LLM_API_KEY environment variable is required')
  if (!model) throw new Error('LLM_MODEL environment variable is required')

  if (provider === 'anthropic') {
    const { AnthropicProvider } = require('./anthropic')
    return new AnthropicProvider(apiKey, model)
  }

  if (provider === 'openai') {
    const { OpenAIProvider } = require('./openai')
    return new OpenAIProvider(apiKey, model)
  }

  throw new Error(`Unknown LLM_PROVIDER: "${provider}". Use "anthropic" or "openai".`)
}
```

- [ ] **Step 1.7: Run tests to verify they pass**

```bash
npm test src/lib/llm/factory.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 1.8: Add LLM env vars to .env.local**

Add to `.env.local`:

```
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-6
LLM_API_KEY=your-anthropic-api-key
```

- [ ] **Step 1.9: Commit**

```bash
git add src/lib/llm/
git commit -m "feat: add provider-agnostic LLM abstraction (Anthropic + OpenAI)"
```

---

### Task 2: System prompts (Czech)

**Files:**
- Create: `src/lib/llm/prompts/brainstorm-conversation.ts`
- Create: `src/lib/llm/prompts/generate-outline.ts`
- Create: `src/lib/llm/prompts/generate-node-text.ts`

- [ ] **Step 2.1: Create brainstorm conversation prompt**

Create `src/lib/llm/prompts/brainstorm-conversation.ts`:

```typescript
export const BRAINSTORM_SYSTEM_PROMPT = `Jsi kreativní asistent pro tvorbu gamebooků v češtině. Pomáháš tvůrcům – dětem i dospělým – vymyslet příběh pro jejich gamebook.

Gamebook je interaktivní příběh, kde čtenář na konci každé části rozhoduje, kam se příběh vydá. Má různé větve, souboje, nalezené předměty a více možných konců.

Tvůj úkol: veď přátelský rozhovor a postupně zjisti tyto informace:
1. Žánr a prostředí (fantasy, sci-fi, detektivka, historický, moderní, atd.)
2. Časové období
3. Hlavní postava/y (jméno, věk, vlastnosti)
4. Hlavní nepřítel nebo konflikt
5. Tón příběhu (vážný, humorný, napínavý, pohádkový)
6. Jeden nebo dva návrhy na zajímavé předměty nebo schopnosti

Pravidla:
- Kladeš vždy jen JEDNU otázku najednou
- Jsi nadšený a povzbuzující
- Pokud tvůrce odpoví stručně, doptej se na detail
- Přizpůsob styl komunikace věku tvůrce (pokud je zřejmé, že je to dítě, piš jednodušeji)
- Nenavrhuj konkrétní názvy knih ani plaguj existující příběhy
- Po 6–8 výměnách nabídni vygenerovat "Základ příběhu"

Odpovídej POUZE v češtině.`

export interface BrainstormMessage {
  role: 'user' | 'assistant'
  content: string
}

export function buildBrainstormMessages(history: BrainstormMessage[]) {
  return [
    { role: 'system' as const, content: BRAINSTORM_SYSTEM_PROMPT },
    ...history,
  ]
}
```

- [ ] **Step 2.2: Create outline generation prompt**

Create `src/lib/llm/prompts/generate-outline.ts`:

```typescript
import { z } from 'zod'

export const OUTLINE_SYSTEM_PROMPT = `Jsi expert na strukturu gamebooků. Dostaneš "Základ příběhu" a vygeneruješ strukturu gamebooku jako JSON.

Gamebook je dirigovaný graf uzlů. Každý uzel je část příběhu. Uzly jsou propojeny volbami čtenáře.

Typy uzlů:
- "story": běžná část příběhu s textem a volbami
- "combat": souboj s nepřítelem
- "item_discovery": čtenář nalezne předmět
- "ending": konec příběhu (dobrý nebo špatný)

Pravidla pro strukturu:
- Vytvoř 15–25 uzlů celkem
- Musí být právě JEDEN startovní uzel (is_start: true)
- Musí být alespoň 2 různé konce (ending uzly)
- Každý story/combat/item_discovery uzel musí mít alespoň 1 odchozí volbu
- Hlavní příběhová linka = 8–12 uzlů
- Přidej 1–2 vedlejší větve (side questy nebo alternativní cesty)
- Přidej alespoň 1 combat uzel a alespoň 1 item_discovery uzel

Vrať POUZE validní JSON bez jakéhokoliv dalšího textu nebo markdown formátování.`

export const OutlineNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['story', 'combat', 'item_discovery', 'ending']),
  title: z.string(),
  summary: z.string(),
  is_start: z.boolean().default(false),
  x: z.number().default(0),
  y: z.number().default(0),
})

export const OutlineChoiceSchema = z.object({
  from_node_id: z.string(),
  to_node_id: z.string(),
  text: z.string(),
})

export const OutlineSchema = z.object({
  nodes: z.array(OutlineNodeSchema),
  choices: z.array(OutlineChoiceSchema),
  suggested_items: z.array(z.object({
    name: z.string(),
    description: z.string(),
    stat_bonus_attribute: z.enum(['sila', 'inteligence', 'obratnost', 'stesti']).nullable(),
    stat_bonus_value: z.number().default(0),
  })),
})

export type OutlineData = z.infer<typeof OutlineSchema>

export function buildOutlinePrompt(storyFoundation: string): string {
  return `Základ příběhu:\n\n${storyFoundation}\n\nVygeneruj strukturu gamebooku jako JSON dle zadaného schématu.`
}
```

- [ ] **Step 2.3: Create node text generation prompt**

Create `src/lib/llm/prompts/generate-node-text.ts`:

```typescript
export const NODE_TEXT_SYSTEM_PROMPT = `Jsi spisovatel gamebooků v češtině. Píšeš text pro jeden uzel gamebooku.

Styl psaní:
- Druhá osoba ("Vstupuješ do tmavé jeskyně...", "Vidíš před sebou...")
- Napínavý, živý jazyk přiměřený cílové skupině (děti/mladí dospělí)
- Délka: 80–150 slov na uzel (kratší pro souboje a item_discovery, delší pro story uzly)
- Pro item_discovery uzly: text MUSÍ přirozeně zmínit nalezení předmětu (např. "Na zemi ležícím mečem se ti zasvítí oči...")
- Pro combat uzly: popis nepřítele, napjatá atmosféra před soubojem
- Pro ending uzly: uspokojivé zakončení (dobré nebo špatné), 60–100 slov
- Nepiš volby – ty jsou definovány zvlášť jako choices

Vrať POUZE text uzlu bez jakéhokoliv formátování nebo vysvětlení.`

export interface NodeTextContext {
  nodeType: string
  nodeTitle: string
  nodeSummary: string
  gamebookTitle: string
  storyFoundation: string
  connectedNodeSummaries: string[]
}

export function buildNodeTextPrompt(ctx: NodeTextContext): string {
  const connectedContext = ctx.connectedNodeSummaries.length > 0
    ? `\nUzly navazující na tento uzel:\n${ctx.connectedNodeSummaries.map(s => `- ${s}`).join('\n')}`
    : ''

  return `Gamebook: ${ctx.gamebookTitle}
Základ příběhu: ${ctx.storyFoundation}

Uzel: ${ctx.nodeTitle} (typ: ${ctx.nodeType})
Shrnutí uzlu: ${ctx.nodeSummary}${connectedContext}

Napiš text pro tento uzel.`
}
```

- [ ] **Step 2.4: Commit**

```bash
git add src/lib/llm/prompts/
git commit -m "feat: add Czech system prompts for brainstorming, outline and node text generation"
```

---

### Task 3: AI API routes

**Files:**
- Create: `src/app/api/ai/brainstorm/route.ts`
- Create: `src/app/api/ai/generate-outline/route.ts`
- Create: `src/app/api/ai/generate-node-text/route.ts`

- [ ] **Step 3.1: Create brainstorm API route**

Create `src/app/api/ai/brainstorm/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/llm/factory'
import { buildBrainstormMessages } from '@/lib/llm/prompts/brainstorm-conversation'
import type { BrainstormMessage } from '@/lib/llm/prompts/brainstorm-conversation'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { history } = await request.json() as { history: BrainstormMessage[] }

  const provider = getProvider()
  const messages = buildBrainstormMessages(history)
  const response = await provider.chat(messages, { temperature: 0.8 })

  return NextResponse.json({ message: response })
}
```

- [ ] **Step 3.2: Create outline generation route**

Create `src/app/api/ai/generate-outline/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/llm/factory'
import {
  OUTLINE_SYSTEM_PROMPT,
  OutlineSchema,
  buildOutlinePrompt,
} from '@/lib/llm/prompts/generate-outline'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyFoundation } = await request.json() as { storyFoundation: string }

  const provider = getProvider()
  const raw = await provider.chat([
    { role: 'system', content: OUTLINE_SYSTEM_PROMPT },
    { role: 'user', content: buildOutlinePrompt(storyFoundation) },
  ], { temperature: 0.7 })

  let parsed
  try {
    parsed = OutlineSchema.parse(JSON.parse(raw))
  } catch {
    return NextResponse.json(
      { error: 'AI vrátila neplatnou strukturu. Zkuste to prosím znovu.' },
      { status: 422 }
    )
  }

  return NextResponse.json(parsed)
}
```

- [ ] **Step 3.3: Create node text generation route (streaming)**

Create `src/app/api/ai/generate-node-text/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/llm/factory'
import {
  NODE_TEXT_SYSTEM_PROMPT,
  buildNodeTextPrompt,
} from '@/lib/llm/prompts/generate-node-text'
import type { NodeTextContext } from '@/lib/llm/prompts/generate-node-text'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const context = await request.json() as NodeTextContext

  const provider = getProvider()
  const stream = provider.stream([
    { role: 'system', content: NODE_TEXT_SYSTEM_PROMPT },
    { role: 'user', content: buildNodeTextPrompt(context) },
  ])

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 3.4: Manually test brainstorm route**

Start the dev server: `npm run dev`

In a terminal:
```bash
curl -X POST http://localhost:3000/api/ai/brainstorm \
  -H "Content-Type: application/json" \
  -d '{"history": [{"role": "user", "content": "Chci napsat fantasy gamebook"}]}'
```

Expected: JSON response with a Czech message asking a follow-up question.

- [ ] **Step 3.5: Commit**

```bash
git add src/app/api/ai/
git commit -m "feat: add AI API routes for brainstorming, outline generation and node text streaming"
```

---

### Task 4: Pre-publish gamebook validator

**Files:**
- Create: `src/lib/validation/gamebook-validator.ts`
- Create: `src/lib/validation/gamebook-validator.test.ts`

- [ ] **Step 4.1: Write failing validator tests**

Create `src/lib/validation/gamebook-validator.test.ts`:

```typescript
import { validateGamebook } from './gamebook-validator'
import type { Node, Choice, CombatConfig } from '@/lib/supabase/types'

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'n1',
    gamebook_id: 'g1',
    type: 'story',
    title: 'Test',
    content: 'Some content',
    is_start: false,
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('validateGamebook', () => {
  it('passes for a minimal valid gamebook', () => {
    const start = makeNode({ id: 'start', is_start: true })
    const end = makeNode({ id: 'end', type: 'ending' })
    const choices: Choice[] = [{
      id: 'c1', from_node_id: 'start', to_node_id: 'end',
      text: 'Pokračuj', condition_item_id: null,
    }]
    const result = validateGamebook({ nodes: [start, end], choices, combatConfigs: [] })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when there is no start node', () => {
    const nodes = [makeNode({ type: 'ending' })]
    const result = validateGamebook({ nodes, choices: [], combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('startovní uzel'))).toBe(true)
  })

  it('fails when there are multiple start nodes', () => {
    const nodes = [
      makeNode({ id: 'a', is_start: true }),
      makeNode({ id: 'b', is_start: true, type: 'ending' }),
    ]
    const result = validateGamebook({ nodes, choices: [], combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('startovní uzel'))).toBe(true)
  })

  it('fails when a non-ending node has no outgoing choices', () => {
    const start = makeNode({ id: 'start', is_start: true, type: 'story' })
    const result = validateGamebook({ nodes: [start], choices: [], combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('slepá ulička'))).toBe(true)
  })

  it('fails when a combat node has no combat config', () => {
    const start = makeNode({ id: 'start', is_start: true, type: 'combat' })
    const end = makeNode({ id: 'end', type: 'ending' })
    const choices: Choice[] = [{
      id: 'c1', from_node_id: 'start', to_node_id: 'end',
      text: 'Pokračuj', condition_item_id: null,
    }]
    const result = validateGamebook({ nodes: [start, end], choices, combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('combat'))).toBe(true)
  })

  it('fails when a combat config is missing victory or defeat node', () => {
    const start = makeNode({ id: 'start', is_start: true, type: 'combat' })
    const end = makeNode({ id: 'end', type: 'ending' })
    const choices: Choice[] = [{
      id: 'c1', from_node_id: 'start', to_node_id: 'end',
      text: 'Pokračuj', condition_item_id: null,
    }]
    const combatConfig: CombatConfig = {
      id: 'cc1', node_id: 'start', enemy_name: 'Drak',
      enemy_sila: 5, enemy_inteligence: 3, enemy_obratnost: 4, enemy_stesti: 2,
      enemy_hp: 15, player_attribute: 'sila', enemy_attribute: 'sila',
      victory_node_id: null, defeat_node_id: null,
    }
    const result = validateGamebook({ nodes: [start, end], choices, combatConfigs: [combatConfig] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('výhra') || e.includes('prohra'))).toBe(true)
  })
})
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
npm test src/lib/validation/gamebook-validator.test.ts
```

Expected: FAIL — `Cannot find module './gamebook-validator'`

- [ ] **Step 4.3: Implement validator**

Create `src/lib/validation/gamebook-validator.ts`:

```typescript
import type { Node, Choice, CombatConfig } from '@/lib/supabase/types'

interface ValidateInput {
  nodes: Node[]
  choices: Choice[]
  combatConfigs: CombatConfig[]
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateGamebook({ nodes, choices, combatConfigs }: ValidateInput): ValidationResult {
  const errors: string[] = []

  // 1. Exactly one start node
  const startNodes = nodes.filter((n) => n.is_start)
  if (startNodes.length === 0) {
    errors.push('Chybí startovní uzel. Označte jeden uzel jako začátek gamebooku.')
  } else if (startNodes.length > 1) {
    errors.push('Více než jeden startovní uzel. Může být označen pouze jeden uzel.')
  }

  // 2. All non-ending nodes must have at least one outgoing choice
  const outgoingByNode = new Map<string, number>()
  for (const choice of choices) {
    outgoingByNode.set(choice.from_node_id, (outgoingByNode.get(choice.from_node_id) ?? 0) + 1)
  }

  for (const node of nodes) {
    if (node.type !== 'ending') {
      const count = outgoingByNode.get(node.id) ?? 0
      if (count === 0) {
        errors.push(`Slepá ulička: uzel "${node.title}" nemá žádné volby a není označen jako konec.`)
      }
    }
  }

  // 3. All nodes must be reachable from start (no orphans)
  if (startNodes.length === 1) {
    const reachable = new Set<string>()
    const queue = [startNodes[0].id]
    const choicesByFrom = new Map<string, string[]>()
    for (const choice of choices) {
      if (!choicesByFrom.has(choice.from_node_id)) choicesByFrom.set(choice.from_node_id, [])
      choicesByFrom.get(choice.from_node_id)!.push(choice.to_node_id)
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (reachable.has(nodeId)) continue
      reachable.add(nodeId)
      const targets = choicesByFrom.get(nodeId) ?? []
      queue.push(...targets)
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        errors.push(`Nedostupný uzel: "${node.title}" není dostupný ze startovního uzlu.`)
      }
    }
  }

  // 4. Combat nodes must have a combat config
  const combatConfigByNode = new Map(combatConfigs.map((c) => [c.node_id, c]))
  for (const node of nodes) {
    if (node.type === 'combat') {
      const config = combatConfigByNode.get(node.id)
      if (!config) {
        errors.push(`Chybí konfigurace souboje pro uzel "${node.title}".`)
      } else {
        if (!config.victory_node_id) {
          errors.push(`Uzel souboje "${node.title}": chybí uzel pro výhru.`)
        }
        if (!config.defeat_node_id) {
          errors.push(`Uzel souboje "${node.title}": chybí uzel pro prohru.`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
npm test src/lib/validation/gamebook-validator.test.ts
```

Expected: PASS — 6 tests passing

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/validation/
git commit -m "feat: add pre-publish gamebook validator"
```

---

### Task 5: Creator dashboard

**Files:**
- Modify: `src/app/tvorit/page.tsx`
- Create: `src/components/creator/dashboard/GamebookList.tsx`
- Create: `src/components/creator/dashboard/GamebookList.test.tsx`
- Create: `src/components/creator/dashboard/CreateGamebookButton.tsx`

- [ ] **Step 5.1: Write failing GamebookList tests**

Create `src/components/creator/dashboard/GamebookList.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import GamebookList from './GamebookList'
import type { Gamebook } from '@/lib/supabase/types'

const mockGamebooks: Gamebook[] = [
  {
    id: 'g1', creator_id: 'u1', creator_display_name: 'Test',
    title: 'Záhadný hrad', description: 'Popis', cover_image_url: null,
    genre: 'Fantasy', status: 'draft', created_at: '2026-03-17T00:00:00Z',
    updated_at: '2026-03-17T00:00:00Z',
  },
  {
    id: 'g2', creator_id: 'u1', creator_display_name: 'Test',
    title: 'Temný les', description: 'Popis 2', cover_image_url: null,
    genre: null, status: 'published', created_at: '2026-03-17T00:00:00Z',
    updated_at: '2026-03-17T00:00:00Z',
  },
]

describe('GamebookList', () => {
  it('renders all gamebook titles', () => {
    render(<GamebookList gamebooks={mockGamebooks} />)
    expect(screen.getByText('Záhadný hrad')).toBeInTheDocument()
    expect(screen.getByText('Temný les')).toBeInTheDocument()
  })

  it('shows draft/published status badges', () => {
    render(<GamebookList gamebooks={mockGamebooks} />)
    expect(screen.getByText('Koncept')).toBeInTheDocument()
    expect(screen.getByText('Publikováno')).toBeInTheDocument()
  })

  it('renders edit links for each gamebook', () => {
    render(<GamebookList gamebooks={mockGamebooks} />)
    const editLinks = screen.getAllByRole('link', { name: /upravit/i })
    expect(editLinks).toHaveLength(2)
    expect(editLinks[0]).toHaveAttribute('href', '/tvorit/g1')
  })

  it('shows empty state when no gamebooks', () => {
    render(<GamebookList gamebooks={[]} />)
    expect(screen.getByText(/zatím žádné/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
npm test src/components/creator/dashboard/GamebookList.test.tsx
```

Expected: FAIL

- [ ] **Step 5.3: Implement GamebookList**

Create `src/components/creator/dashboard/GamebookList.tsx`:

```typescript
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Gamebook } from '@/lib/supabase/types'
import { BookOpen } from 'lucide-react'

interface GamebookListProps {
  gamebooks: Gamebook[]
}

export default function GamebookList({ gamebooks }: GamebookListProps) {
  if (gamebooks.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Zatím žádné gamebooky. Vytvořte svůj první!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {gamebooks.map((gamebook) => (
        <div
          key={gamebook.id}
          className="flex items-center justify-between p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{gamebook.title}</span>
              <Badge variant={gamebook.status === 'published' ? 'default' : 'secondary'}>
                {gamebook.status === 'published' ? 'Publikováno' : 'Koncept'}
              </Badge>
              {gamebook.genre && (
                <Badge variant="outline" className="text-xs">{gamebook.genre}</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 line-clamp-1">{gamebook.description}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/tvorit/${gamebook.id}`}>Upravit</Link>
          </Button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
npm test src/components/creator/dashboard/GamebookList.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 5.5: Create CreateGamebookButton**

Create `src/components/creator/dashboard/CreateGamebookButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

interface CreateGamebookButtonProps {
  creatorDisplayName: string
  creatorId: string
}

export default function CreateGamebookButton({ creatorDisplayName, creatorId }: CreateGamebookButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!title.trim()) {
      setError('Zadejte název gamebooku.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('gamebooks')
      .insert({
        title: title.trim(),
        creator_id: creatorId,
        creator_display_name: creatorDisplayName,
        description: '',
        status: 'draft',
      })
      .select('id')
      .single()

    if (error || !data) {
      setError('Nepodařilo se vytvořit gamebook. Zkuste to znovu.')
      setLoading(false)
      return
    }

    setOpen(false)
    router.push(`/tvorit/${data.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nový gamebook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vytvořit nový gamebook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Název</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Záhadný hrad"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Vytvářím…' : 'Vytvořit a začít'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

Install dialog component:

```bash
npx shadcn@latest add dialog
```

- [ ] **Step 5.6: Update creator dashboard page**

Replace `src/app/tvorit/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import GamebookList from '@/components/creator/dashboard/GamebookList'
import CreateGamebookButton from '@/components/creator/dashboard/CreateGamebookButton'
import { BookOpen, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Moje gamebooky — Gamebooker' }

export default async function TvoritPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: gamebooks } = await supabase
    .from('gamebooks')
    .select('*')
    .eq('creator_id', user!.id)
    .order('updated_at', { ascending: false })

  const displayName = user!.email?.split('@')[0] ?? 'Tvůrce'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg text-slate-900">Gamebooker</span>
            <span className="text-slate-400 text-sm ml-2">Tvůrce</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user!.email}</span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Moje gamebooky</h1>
          <CreateGamebookButton
            creatorDisplayName={displayName}
            creatorId={user!.id}
          />
        </div>
        <GamebookList gamebooks={gamebooks ?? []} />
      </main>
    </div>
  )
}
```

- [ ] **Step 5.7: Add sign-out API route**

Create `src/app/api/auth/signout/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
}
```

Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `.env.local`.

- [ ] **Step 5.8: Run all tests**

```bash
npm test
```

Expected: PASS

- [ ] **Step 5.9: Commit**

```bash
git add src/app/tvorit/ src/components/creator/dashboard/ src/app/api/auth/
git commit -m "feat: add creator dashboard with gamebook list and create dialog"
```

---

### Task 6: Gamebook editor — node graph canvas

**Files:**
- Create: `src/app/tvorit/[id]/page.tsx`
- Create: `src/components/creator/editor/GamebookEditor.tsx`
- Create: `src/components/creator/editor/NodeGraph.tsx`
- Create: `src/components/creator/editor/NodeGraph.test.tsx`

- [ ] **Step 6.1: Install React Flow**

```bash
npm install @xyflow/react
```

- [ ] **Step 6.2: Write failing NodeGraph tests**

Create `src/components/creator/editor/NodeGraph.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import NodeGraph from './NodeGraph'
import type { Node, Choice } from '@/lib/supabase/types'

// React Flow uses ResizeObserver which is not available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const mockNodes: Node[] = [
  { id: 'n1', gamebook_id: 'g1', type: 'story', title: 'Začátek', content: '', is_start: true, x: 0, y: 0 },
  { id: 'n2', gamebook_id: 'g1', type: 'ending', title: 'Konec', content: '', is_start: false, x: 200, y: 200 },
]
const mockChoices: Choice[] = [
  { id: 'c1', from_node_id: 'n1', to_node_id: 'n2', text: 'Pokračuj', condition_item_id: null },
]

describe('NodeGraph', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <NodeGraph
        nodes={mockNodes}
        choices={mockChoices}
        selectedNodeId={null}
        onNodeSelect={jest.fn()}
        onNodesChange={jest.fn()}
        onChoicesChange={jest.fn()}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})
```

- [ ] **Step 6.3: Run tests to verify they fail**

```bash
npm test src/components/creator/editor/NodeGraph.test.tsx
```

Expected: FAIL

- [ ] **Step 6.4: Implement NodeGraph**

Create `src/components/creator/editor/NodeGraph.tsx`:

```typescript
'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Node, Choice } from '@/lib/supabase/types'

const NODE_COLORS: Record<string, string> = {
  story: '#6366f1',
  combat: '#ef4444',
  item_discovery: '#f59e0b',
  ending: '#10b981',
}

interface NodeGraphProps {
  nodes: Node[]
  choices: Choice[]
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
  onNodesChange: (nodes: Node[]) => void
  onChoicesChange: (choices: Choice[]) => void
}

export default function NodeGraph({
  nodes,
  choices,
  selectedNodeId,
  onNodeSelect,
  onNodesChange,
  onChoicesChange,
}: NodeGraphProps) {
  const rfNodes: RFNode[] = useMemo(() =>
    nodes.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      data: { label: n.title, type: n.type, is_start: n.is_start },
      selected: n.id === selectedNodeId,
      style: {
        background: NODE_COLORS[n.type] ?? '#6366f1',
        color: '#fff',
        borderRadius: 8,
        border: n.is_start ? '3px solid #1e1b4b' : 'none',
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 600,
        minWidth: 120,
      },
    })),
  [nodes, selectedNodeId])

  const rfEdges: Edge[] = useMemo(() =>
    choices.map((c) => ({
      id: c.id,
      source: c.from_node_id,
      target: c.to_node_id,
      label: c.text,
      animated: false,
    })),
  [choices])

  const [rfNodesState, , onRFNodesChange] = useNodesState(rfNodes)
  const [rfEdgesState, setEdges, onRFEdgesChange] = useEdgesState(rfEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  // Persist node positions after drag
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, rfNode: RFNode) => {
      const updated = nodes.map((n) =>
        n.id === rfNode.id ? { ...n, x: rfNode.position.x, y: rfNode.position.y } : n
      )
      onNodesChange(updated)
    },
    [nodes, onNodesChange]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodesState}
        edges={rfEdgesState}
        onNodesChange={onRFNodesChange}
        onEdgesChange={onRFEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        onNodeDragStop={onNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 6.5: Run tests to verify they pass**

```bash
npm test src/components/creator/editor/NodeGraph.test.tsx
```

Expected: PASS — 1 test passing

- [ ] **Step 6.6: Commit**

```bash
git add src/components/creator/editor/NodeGraph.tsx src/components/creator/editor/NodeGraph.test.tsx
git commit -m "feat: add React Flow node graph canvas"
```

---

### Task 7: Node detail panel + editor page

**Files:**
- Create: `src/components/creator/editor/NodeDetailPanel.tsx`
- Create: `src/components/creator/editor/NodeDetailPanel.test.tsx`
- Create: `src/components/creator/editor/GamebookEditor.tsx`
- Create: `src/app/tvorit/[id]/page.tsx`

- [ ] **Step 7.1: Write failing NodeDetailPanel tests**

Create `src/components/creator/editor/NodeDetailPanel.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NodeDetailPanel from './NodeDetailPanel'
import type { Node } from '@/lib/supabase/types'

const mockNode: Node = {
  id: 'n1', gamebook_id: 'g1', type: 'story',
  title: 'Lesní cesta', content: 'Jdeš lesem.',
  is_start: false, x: 0, y: 0,
}

describe('NodeDetailPanel', () => {
  it('shows node title and content', () => {
    render(<NodeDetailPanel node={mockNode} onSave={jest.fn()} onGenerateText={jest.fn()} />)
    expect(screen.getByDisplayValue('Lesní cesta')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jdeš lesem.')).toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', async () => {
    const onSave = jest.fn()
    render(<NodeDetailPanel node={mockNode} onSave={onSave} onGenerateText={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /uložit/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', title: 'Lesní cesta' })
    )
  })

  it('calls onGenerateText when generate button is clicked', async () => {
    const onGenerateText = jest.fn()
    render(<NodeDetailPanel node={mockNode} onSave={jest.fn()} onGenerateText={onGenerateText} />)
    await userEvent.click(screen.getByRole('button', { name: /generovat/i }))
    expect(onGenerateText).toHaveBeenCalledWith('n1')
  })
})
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
npm test src/components/creator/editor/NodeDetailPanel.test.tsx
```

Expected: FAIL

- [ ] **Step 7.3: Implement NodeDetailPanel**

Create `src/components/creator/editor/NodeDetailPanel.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Node } from '@/lib/supabase/types'
import { Sparkles, Save } from 'lucide-react'

interface NodeDetailPanelProps {
  node: Node
  onSave: (node: Node) => void
  onGenerateText: (nodeId: string) => void
  isGenerating?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  story: 'Příběh',
  combat: 'Souboj',
  item_discovery: 'Předmět',
  ending: 'Konec',
}

export default function NodeDetailPanel({
  node,
  onSave,
  onGenerateText,
  isGenerating = false,
}: NodeDetailPanelProps) {
  const [title, setTitle] = useState(node.title)
  const [content, setContent] = useState(node.content)

  function handleSave() {
    onSave({ ...node, title, content })
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{TYPE_LABELS[node.type]}</Badge>
        {node.is_start && <Badge variant="default">Začátek</Badge>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="node-title">Název uzlu</Label>
        <Input
          id="node-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="node-content">Text příběhu</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGenerateText(node.id)}
            disabled={isGenerating}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {isGenerating ? 'Generuji…' : 'Generovat AI'}
          </Button>
        </div>
        <textarea
          id="node-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-48 p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Text příběhu pro čtenáře…"
        />
      </div>

      <Button onClick={handleSave} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Uložit uzel
      </Button>
    </div>
  )
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

```bash
npm test src/components/creator/editor/NodeDetailPanel.test.tsx
```

Expected: PASS — 3 tests passing

- [ ] **Step 7.5: Implement GamebookEditor (client root)**

Create `src/components/creator/editor/GamebookEditor.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import NodeGraph from './NodeGraph'
import NodeDetailPanel from './NodeDetailPanel'
import PublishButton from './PublishButton'
import BrainstormChat from '../ai/BrainstormChat'
import { createClient } from '@/lib/supabase/client'
import type { Node, Choice, Gamebook } from '@/lib/supabase/types'

interface GamebookEditorProps {
  gamebook: Gamebook
  initialNodes: Node[]
  initialChoices: Choice[]
}

export default function GamebookEditor({
  gamebook,
  initialNodes,
  initialChoices,
}: GamebookEditorProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showBrainstorm, setShowBrainstorm] = useState(initialNodes.length === 0)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const supabase = createClient()

  const handleSaveNode = useCallback(async (updatedNode: Node) => {
    await supabase
      .from('nodes')
      .update({ title: updatedNode.title, content: updatedNode.content })
      .eq('id', updatedNode.id)

    setNodes((prev) => prev.map((n) => n.id === updatedNode.id ? updatedNode : n))
  }, [supabase])

  const handleGenerateText = useCallback(async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    setIsGenerating(true)
    const connectedIds = choices
      .filter((c) => c.from_node_id === nodeId)
      .map((c) => c.to_node_id)
    const connectedSummaries = nodes
      .filter((n) => connectedIds.includes(n.id))
      .map((n) => n.title)

    const response = await fetch('/api/ai/generate-node-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeType: node.type,
        nodeTitle: node.title,
        nodeSummary: node.title,
        gamebookTitle: gamebook.title,
        storyFoundation: gamebook.description ?? '',
        connectedNodeSummaries: connectedSummaries,
      }),
    })

    if (!response.ok || !response.body) {
      setIsGenerating(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''

    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, content: '' } : n))

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      const captured = text
      setNodes((prev) =>
        prev.map((n) => n.id === nodeId ? { ...n, content: captured } : n)
      )
    }

    // Persist to DB
    await supabase.from('nodes').update({ content: text }).eq('id', nodeId)
    setIsGenerating(false)
  }, [nodes, choices, gamebook, supabase])

  return (
    <div className="h-screen flex flex-col">
      {/* Editor header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="font-bold text-slate-900">{gamebook.title}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBrainstorm((v) => !v)}
            className="text-sm text-indigo-600 hover:underline"
          >
            {showBrainstorm ? 'Skrýt AI asistenta' : 'AI asistent'}
          </button>
          <PublishButton
            gamebookId={gamebook.id}
            currentStatus={gamebook.status}
            onPublished={() => window.location.reload()}
          />
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node graph (center) */}
        <div className="flex-1">
          <NodeGraph
            nodes={nodes}
            choices={choices}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodesChange={setNodes}
            onChoicesChange={setChoices}
          />
        </div>

        {/* Right panel: node detail */}
        {selectedNode && (
          <div className="w-80 border-l bg-white shrink-0">
            <NodeDetailPanel
              node={selectedNode}
              onSave={handleSaveNode}
              onGenerateText={handleGenerateText}
              isGenerating={isGenerating}
            />
          </div>
        )}
      </div>

      {/* Bottom panel: AI brainstorm */}
      {showBrainstorm && (
        <div className="h-72 border-t bg-white shrink-0">
          <BrainstormChat
            gamebookId={gamebook.id}
            onOutlineGenerated={(outline) => {
              // Plan 2 Task 8 wires this up
              console.log('Outline generated:', outline)
            }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7.6: Create editor page (server)**

Create `src/app/tvorit/[id]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import GamebookEditor from '@/components/creator/editor/GamebookEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/prihlasit')

  const [{ data: gamebook }, { data: nodes }] = await Promise.all([
    supabase.from('gamebooks').select('*').eq('id', id).eq('creator_id', user.id).single(),
    supabase.from('nodes').select('*').eq('gamebook_id', id),
  ])

  if (!gamebook) notFound()

  // Choices depend on node IDs, so fetched after nodes
  const { data: choices } = await supabase
    .from('choices')
    .select('*')
    .in('from_node_id', (nodes ?? []).map((n) => n.id))

  return (
    <GamebookEditor
      gamebook={gamebook}
      initialNodes={nodes ?? []}
      initialChoices={choices ?? []}
    />
  )
}
```

- [ ] **Step 7.7: Run all tests**

```bash
npm test
```

Expected: PASS

- [ ] **Step 7.8: Commit**

```bash
git add src/components/creator/editor/ src/app/tvorit/
git commit -m "feat: add gamebook editor with node graph and node detail panel"
```

---

### Task 8: BrainstormChat + outline wiring

**Files:**
- Create: `src/components/creator/ai/BrainstormChat.tsx`
- Create: `src/components/creator/ai/BrainstormChat.test.tsx`

- [ ] **Step 8.1: Write failing BrainstormChat tests**

Create `src/components/creator/ai/BrainstormChat.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BrainstormChat from './BrainstormChat'

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ message: 'Jaký žánr tě zajímá?' }),
})

describe('BrainstormChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows initial greeting', () => {
    render(<BrainstormChat gamebookId="g1" onOutlineGenerated={jest.fn()} />)
    expect(screen.getByText(/ahoj/i)).toBeInTheDocument()
  })

  it('sends message and shows response', async () => {
    render(<BrainstormChat gamebookId="g1" onOutlineGenerated={jest.fn()} />)
    const input = screen.getByPlaceholderText(/napiš/i)
    await userEvent.type(input, 'Chci fantasy gamebook')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Jaký žánr tě zajímá?')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8.2: Run tests to verify they fail**

```bash
npm test src/components/creator/ai/BrainstormChat.test.tsx
```

Expected: FAIL

- [ ] **Step 8.3: Implement BrainstormChat**

Create `src/components/creator/ai/BrainstormChat.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Sparkles } from 'lucide-react'
import type { OutlineData } from '@/lib/llm/prompts/generate-outline'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface BrainstormChatProps {
  gamebookId: string
  onOutlineGenerated: (outline: OutlineData) => void
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Ahoj! Jsem tvůj AI asistent pro tvorbu gamebooků. Řekni mi o svém příběhu – jaké prostředí nebo žánr tě zajímá?',
}

export default function BrainstormChat({ gamebookId, onOutlineGenerated }: BrainstormChatProps) {
  const [history, setHistory] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingOutline, setGeneratingOutline] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newHistory = [...history, userMessage]
    setHistory(newHistory)
    setInput('')
    setLoading(true)

    // Skip index 0 (the initial greeting) — it is not part of the real conversation
    const conversationHistory = newHistory.slice(1)

    const res = await fetch('/api/ai/brainstorm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: conversationHistory }),
    })

    const { message } = await res.json()
    setHistory((prev) => [...prev, { role: 'assistant', content: message }])
    setLoading(false)
  }

  async function generateOutline() {
    setGeneratingOutline(true)
    const storyFoundation = history
      .filter((m) => m.role !== 'assistant' || m !== INITIAL_MESSAGE)
      .map((m) => `${m.role === 'user' ? 'Tvůrce' : 'AI'}: ${m.content}`)
      .join('\n')

    const res = await fetch('/api/ai/generate-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyFoundation }),
    })

    if (res.ok) {
      const outline = await res.json()
      onOutlineGenerated(outline)
    }
    setGeneratingOutline(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI Asistent
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={generateOutline}
          disabled={generatingOutline || history.length < 4}
        >
          {generatingOutline ? 'Generuji osnovu…' : 'Vygenerovat osnovu'}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {history.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-3 py-2 text-sm text-slate-500">
              Přemýšlím…
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Napiš o svém příběhu…"
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

```bash
npm test src/components/creator/ai/BrainstormChat.test.tsx
```

Expected: PASS — 2 tests passing

- [ ] **Step 8.5: Run all tests**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 8.6: Commit**

```bash
git add src/components/creator/ai/
git commit -m "feat: add BrainstormChat component with AI conversation and outline generation"
```

---

### Task 9: Publish flow

**Files:**
- Create: `src/components/creator/editor/PublishButton.tsx`
- Create: `src/app/api/gamebooks/[id]/publish/route.ts`

- [ ] **Step 9.1: Create publish API route**

Create `src/app/api/gamebooks/[id]/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateGamebook } from '@/lib/validation/gamebook-validator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: gamebook } = await supabase
    .from('gamebooks')
    .select('id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!gamebook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all data for validation
  const [{ data: nodes }, { data: combatConfigs }] = await Promise.all([
    supabase.from('nodes').select('*').eq('gamebook_id', id),
    supabase.from('combat_configs').select('*').in(
      'node_id',
      (await supabase.from('nodes').select('id').eq('gamebook_id', id)).data?.map((n) => n.id) ?? []
    ),
  ])

  const nodeIds = (nodes ?? []).map((n) => n.id)
  const { data: choices } = await supabase
    .from('choices')
    .select('*')
    .in('from_node_id', nodeIds)

  const validation = validateGamebook({
    nodes: nodes ?? [],
    choices: choices ?? [],
    combatConfigs: combatConfigs ?? [],
  })

  if (!validation.valid) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 })
  }

  await supabase
    .from('gamebooks')
    .update({ status: 'published' })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 9.2: Create PublishButton component**

Create `src/components/creator/editor/PublishButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Globe, AlertCircle } from 'lucide-react'

interface PublishButtonProps {
  gamebookId: string
  currentStatus: string
  onPublished: () => void
}

export default function PublishButton({
  gamebookId,
  currentStatus,
  onPublished,
}: PublishButtonProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function handlePublish() {
    setLoading(true)
    setErrors([])

    const res = await fetch(`/api/gamebooks/${gamebookId}/publish`, {
      method: 'POST',
    })

    if (res.ok) {
      onPublished()
    } else {
      const data = await res.json()
      setErrors(data.errors ?? ['Nepodařilo se publikovat gamebook.'])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePublish}
        disabled={loading || currentStatus === 'published'}
        variant={currentStatus === 'published' ? 'outline' : 'default'}
      >
        <Globe className="w-4 h-4 mr-2" />
        {loading ? 'Publikuji…' : currentStatus === 'published' ? 'Publikováno' : 'Publikovat'}
      </Button>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1 text-red-700 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Před publikováním opravte tyto chyby:
          </div>
          <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 9.3: Run all tests**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 9.4: Commit**

```bash
git add src/components/creator/editor/PublishButton.tsx src/app/api/gamebooks/
git commit -m "feat: add publish flow with pre-publish validation"
```

---

### Task 10: Deploy and verify

- [ ] **Step 10.1: Add LLM env vars to Vercel**

In Vercel project → Settings → Environment Variables, add:
```
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-6
LLM_API_KEY=your-anthropic-api-key
NEXT_PUBLIC_SITE_URL=https://your-vercel-url.vercel.app
```

- [ ] **Step 10.2: Push to GitHub**

```bash
git push
```

- [ ] **Step 10.3: Verify production**

- Login as creator ✓
- Create a new gamebook ✓
- Use AI brainstorm chat ✓
- Generate outline ✓
- Click a node → edit text → generate AI text ✓
- Attempt to publish → see validation errors ✓

- [ ] **Step 10.4: Final commit tag**

```bash
git tag plan-2-complete
git push --tags
```

---

## What Plan 3 builds on this

Plan 3 (Reader) fills in `src/app/hrat/[id]/page.tsx` with the full character creation screen, reading interface, inventory system, and combat engine. All the data it needs (nodes, choices, items, combat configs) is now in the database, readable via RLS by anonymous users for published gamebooks.
