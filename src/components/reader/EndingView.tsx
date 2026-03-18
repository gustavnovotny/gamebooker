'use client'

import { useRouter } from 'next/navigation'
import { clearSession } from '@/lib/reader/session'
import type { Node } from '@/lib/supabase/types'

interface Props {
  gamebookId: string
  node: Node
}

export default function EndingView({ gamebookId, node }: Props) {
  const router = useRouter()

  function handleRestart() {
    clearSession(gamebookId)
    router.push(`/hrat/${gamebookId}`)
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">{node.title}</h2>
      <p className="text-slate-700 whitespace-pre-wrap mb-8 leading-relaxed">{node.content}</p>
      <button
        onClick={handleRestart}
        className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium"
      >
        Hrát znovu
      </button>
    </div>
  )
}
