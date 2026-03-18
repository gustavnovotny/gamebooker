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
