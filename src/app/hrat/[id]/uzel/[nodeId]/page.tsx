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
