'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/reader/session'
import CharacterCreation from './CharacterCreation'

interface Props {
  gamebookId: string
  gamebookTitle: string
  startNodeId: string | null
}

export default function GameStartClient({ gamebookId, gamebookTitle, startNodeId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const session = getSession(gamebookId)
    if (session) {
      router.replace(`/hrat/${gamebookId}/uzel/${session.currentNodeId}`)
    }
  }, [gamebookId, router])

  if (!startNodeId) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Tento gamebook nemá startovní uzel.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <CharacterCreation
        gamebookId={gamebookId}
        startNodeId={startNodeId}
        gamebookTitle={gamebookTitle}
      />
    </main>
  )
}
