export const NODE_TEXT_SYSTEM_PROMPT = `Jsi spisovatel gamebooků v češtině. Píšeš text pro jeden uzel gamebooku.

Styl psaní:
- Druhá osoba ("Vstupuješ do tmavé jeskyně...", "Vidíš před sebou...")
- Napínavý, živý jazyk přiměřený cílové skupině (děti/mladí dospělí)
- Délka: 80–150 slov (kratší pro souboje a item_discovery, delší pro story)
- Pro item_discovery: text MUSÍ přirozeně zmínit nalezení předmětu
- Pro combat: popis nepřítele, napjatá atmosféra před soubojem
- Pro ending: uspokojivé zakončení, 60–100 slov
- Nepiš volby – ty jsou definovány zvlášť

NEJDŮLEŽITĚJŠÍ PRAVIDLO: Text musí plynně navazovat na předchozí příběh.
Čtenář právě prošel konkrétní volbou – text musí reagovat na tuto volbu
a nesmí ignorovat, co se předtím dělo.

Vrať POUZE text uzlu bez jakéhokoliv formátování nebo vysvětlení.`

export interface AncestorNodeContext {
  nodeTitle: string
  nodeSummary: string
  nodeContent: string
  choiceTextLeadingForward: string
}

export interface OutgoingNodeContext {
  title: string
  summary: string
}

export interface NodeTextContext {
  nodeType: 'story' | 'combat' | 'item_discovery' | 'ending'
  nodeTitle: string
  nodeSummary: string
  gamebookTitle: string
  storyFoundation: string
  // Ordered from oldest to newest: [grandparent, parent]
  ancestors: AncestorNodeContext[]
  outgoingNodes: OutgoingNodeContext[]
}

export function buildNodeTextPrompt(ctx: NodeTextContext): string {
  const lines: string[] = []

  lines.push(`Gamebook: ${ctx.gamebookTitle}`)
  if (ctx.storyFoundation) {
    lines.push(`Základ příběhu: ${ctx.storyFoundation}`)
  }
  lines.push('')

  if (ctx.ancestors.length === 0) {
    lines.push('=== KONTEXT: Toto je startovní uzel — čtenář zde začíná. ===')
  } else {
    lines.push('=== PRŮBĚH PŘÍBĚHU (od nejstaršího k nejnovějšímu) ===')
    ctx.ancestors.forEach((a, i) => {
      const level = ctx.ancestors.length - i
      lines.push(`\n[Uzel ${level} ${level === 1 ? 'úroveň' : 'úrovně'} zpět]: "${a.nodeTitle}"`)
      if (a.nodeSummary) lines.push(`Osnova: ${a.nodeSummary}`)
      if (a.nodeContent) lines.push(`Text: ${a.nodeContent}`)
      lines.push(`→ Čtenář zvolil: "${a.choiceTextLeadingForward}"`)
    })
  }

  lines.push('')
  lines.push('=== UZEL KTERÝ PÍŠEŠ ===')
  lines.push(`Název: "${ctx.nodeTitle}" (typ: ${ctx.nodeType})`)
  if (ctx.nodeSummary) {
    lines.push(`Osnova (co se má dít): ${ctx.nodeSummary}`)
  }

  if (ctx.outgoingNodes.length > 0) {
    lines.push('')
    lines.push('Tento uzel vede dál do:')
    ctx.outgoingNodes.forEach((n) => {
      lines.push(`  - "${n.title}"${n.summary ? `: ${n.summary}` : ''}`)
    })
  }

  lines.push('')
  lines.push('Napiš plynný příběhový text pro tento uzel. Navazuj na volbu, kterou čtenář právě učinil.')

  return lines.join('\n')
}
