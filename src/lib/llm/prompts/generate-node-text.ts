export const NODE_TEXT_SYSTEM_PROMPT = `Jsi spisovatel gamebooků v češtině. Píšeš text pro jeden uzel gamebooku.

Styl psaní:
- Druhá osoba ("Vstupuješ do tmavé jeskyně...", "Vidíš před sebou...")
- Napínavý, živý jazyk přiměřený cílové skupině (děti/mladí dospělí)
- Délka: 80–150 slov na uzel (kratší pro souboje a item_discovery, delší pro story uzly)
- Pro item_discovery uzly: text MUSÍ přirozeně zmínit nalezení předmětu
- Pro combat uzly: popis nepřítele, napjatá atmosféra před soubojem
- Pro ending uzly: uspokojivé zakončení (dobré nebo špatné), 60–100 slov
- Nepiš volby – ty jsou definovány zvlášť jako choices
- Text musí plynule navazovat na předchozí uzel a volbu, kterou čtenář učinil

Vrať POUZE text uzlu bez jakéhokoliv formátování nebo vysvětlení.`

export interface IncomingChoiceContext {
  choiceText: string
  fromNodeTitle: string
  fromNodeContent: string
}

export interface OutgoingNodeContext {
  title: string
  content: string
}

export interface NodeTextContext {
  nodeType: 'story' | 'combat' | 'item_discovery' | 'ending'
  nodeTitle: string
  gamebookTitle: string
  storyFoundation: string
  incomingContext: IncomingChoiceContext[]
  outgoingNodes: OutgoingNodeContext[]
}

export function buildNodeTextPrompt(ctx: NodeTextContext): string {
  const foundationSection = ctx.storyFoundation
    ? `\nZáklad příběhu / svět: ${ctx.storyFoundation}`
    : ''

  const incomingSection = ctx.incomingContext.length > 0
    ? `\nČtenář přišel do tohoto uzlu přes:\n` + ctx.incomingContext.map((ic) =>
        `  Volba: "${ic.choiceText}"\n  Z uzlu: "${ic.fromNodeTitle}"\n  Text předchozího uzlu: ${ic.fromNodeContent || '(bez textu)'}`
      ).join('\n---\n')
    : '\n(Toto je startovní uzel – čtenář zde začíná.)'

  const outgoingSection = ctx.outgoingNodes.length > 0
    ? `\nTento uzel vede dál do uzlů:\n` + ctx.outgoingNodes.map((n) =>
        `  - "${n.title}"${n.content ? `: ${n.content.slice(0, 80)}…` : ''}`
      ).join('\n')
    : ''

  return `Gamebook: ${ctx.gamebookTitle}${foundationSection}

Uzel který píšeš: "${ctx.nodeTitle}" (typ: ${ctx.nodeType})
${incomingSection}${outgoingSection}

Napiš text pro tento uzel. Musí plynně navazovat na předchozí kontext.`
}
