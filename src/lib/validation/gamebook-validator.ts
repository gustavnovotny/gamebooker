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
        errors.push(`slepá ulička: uzel "${node.title}" nemá žádné volby a není označen jako konec.`)
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
        errors.push(`Chybí konfigurace souboje pro uzel "${node.title}". Chybí combat config.`)
      } else {
        if (!config.victory_node_id) {
          errors.push(`Uzel souboje "${node.title}": chybí uzel pro výhra.`)
        }
        if (!config.defeat_node_id) {
          errors.push(`Uzel souboje "${node.title}": chybí uzel pro prohra.`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
