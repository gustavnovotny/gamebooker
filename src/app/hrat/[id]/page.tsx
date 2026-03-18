import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Gamebook, Node } from '@/lib/supabase/types'
import GameStartClient from '@/components/reader/GameStartClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HratPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawGamebook }, { data: rawStartNode }] = await Promise.all([
    supabase.from('gamebooks').select('*').eq('id', id).eq('status', 'published').single(),
    supabase.from('nodes').select('id').eq('gamebook_id', id).eq('is_start', true).single(),
  ])

  const gamebook = rawGamebook as Gamebook | null
  if (!gamebook) notFound()

  const startNode = rawStartNode as Pick<Node, 'id'> | null

  return (
    <GameStartClient
      gamebookId={id}
      gamebookTitle={gamebook.title}
      startNodeId={startNode?.id ?? null}
    />
  )
}
