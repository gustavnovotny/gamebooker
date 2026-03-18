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
