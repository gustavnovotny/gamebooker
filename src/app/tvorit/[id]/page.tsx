import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import GamebookEditor from '@/components/creator/editor/GamebookEditor'
import type { Gamebook, Node, Choice } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/prihlasit')

  const [{ data: rawGamebook }, { data: rawNodes }] = await Promise.all([
    supabase.from('gamebooks').select('*').eq('id', id).eq('creator_id', user.id).single(),
    supabase.from('nodes').select('*').eq('gamebook_id', id),
  ])

  const gamebook = rawGamebook as Gamebook | null
  const nodes = (rawNodes as Node[]) ?? []

  if (!gamebook) notFound()

  // Choices depend on node IDs, so fetched after nodes
  const nodeIds = nodes.map((n) => n.id)
  const { data: rawChoices } = nodeIds.length > 0
    ? await supabase.from('choices').select('*').in('from_node_id', nodeIds)
    : { data: [] }

  const choices = (rawChoices as Choice[]) ?? []

  return (
    <GamebookEditor
      gamebook={gamebook}
      initialNodes={nodes ?? []}
      initialChoices={choices ?? []}
    />
  )
}
