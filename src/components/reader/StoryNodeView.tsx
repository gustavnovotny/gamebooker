'use client'

import { useRouter } from 'next/navigation'
import type { Node, Choice } from '@/lib/supabase/types'

interface Props {
  gamebookId: string
  node: Node
  choices: Choice[]
}

export default function StoryNodeView({ gamebookId, node, choices }: Props) {
  const router = useRouter()

  return (
    <div className="max-w-xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">{node.title}</h2>
      <p className="text-slate-700 whitespace-pre-wrap mb-8 leading-relaxed">{node.content}</p>
      <div className="space-y-3">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => router.push(`/hrat/${gamebookId}/uzel/${choice.to_node_id}`)}
            className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900 transition-colors text-sm cursor-pointer"
          >
            {choice.text}
          </button>
        ))}
      </div>
    </div>
  )
}
