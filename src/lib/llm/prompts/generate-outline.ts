import { z } from 'zod'

export const OUTLINE_SYSTEM_PROMPT = `Jsi expert na strukturu gamebooků. Dostaneš "Základ příběhu" a vygeneruješ strukturu gamebooku jako JSON.

Gamebook je dirigovaný graf uzlů. Každý uzel je část příběhu. Uzly jsou propojeny volbami čtenáře.

Typy uzlů:
- "story": běžná část příběhu s textem a volbami
- "combat": souboj s nepřítelem
- "item_discovery": čtenář nalezne předmět
- "ending": konec příběhu (dobrý nebo špatný)

Pravidla pro strukturu:
- Vytvoř PŘESNĚ 10–12 uzlů celkem – ne více, odpověď musí být krátká
- Musí být právě JEDEN startovní uzel (is_start: true)
- Musí být alespoň 2 různé konce (ending uzly)
- Každý story/combat/item_discovery uzel musí mít alespoň 1 odchozí volbu
- Přidej alespoň 1 combat uzel a alespoň 1 item_discovery uzel

Vrať POUZE validní JSON v přesně tomto formátu (žádný markdown, žádné bloky kódu):

{
  "nodes": [
    {
      "id": "node_01",
      "type": "story",
      "title": "Krátký název uzlu",
      "summary": "Jedno nebo dvě věty popisující co se v uzlu děje.",
      "is_start": true
    }
  ],
  "choices": [
    {
      "from_node_id": "node_01",
      "to_node_id": "node_02",
      "text": "Text volby kterou čtenář vidí"
    }
  ],
  "suggested_items": [
    {
      "name": "Název předmětu",
      "description": "Popis předmětu",
      "stat_bonus_attribute": null,
      "stat_bonus_value": 0
    }
  ]
}

DŮLEŽITÉ: "choices" je samostatné pole na vrchní úrovni JSON, NE součást každého uzlu.`

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
    stat_bonus_attribute: z.enum(['sila', 'inteligence', 'obratnost', 'stesti']).nullable().catch(null),
    stat_bonus_value: z.number().default(0),
  })).default([]),
})

export type OutlineData = z.infer<typeof OutlineSchema>

export function buildOutlinePrompt(storyFoundation: string): string {
  return `Základ příběhu:\n\n${storyFoundation}\n\nVygeneruj strukturu gamebooku jako JSON dle zadaného schématu.`
}
