'use client'

import { useEffect, useState } from 'react'
import { saveSession } from '@/lib/reader/session'
import type { GameSession } from '@/lib/reader/session'
import type { Node, Choice, Item } from '@/lib/supabase/types'
import StoryNodeView from './StoryNodeView'

interface Props {
  gamebookId: string
  node: Node
  choices: Choice[]
  assignedItems: Item[]
  session: GameSession
}

export default function ItemDiscoveryNodeView({ gamebookId, node, choices, assignedItems, session }: Props) {
  const [toasts, setToasts] = useState<string[]>([])

  useEffect(() => {
    const ownedIds = new Set(session.inventory.map((i) => i.id))
    const newItems = assignedItems.filter((i) => !ownedIds.has(i.id))
    if (newItems.length === 0) return

    saveSession({ ...session, inventory: [...session.inventory, ...newItems] })
    setToasts(newItems.map((i) => i.name))

    const timer = setTimeout(() => setToasts([]), 3000)
    return () => clearTimeout(timer)
  }, []) // intentionally run once on mount

  return (
    <>
      {toasts.map((name) => (
        <div
          key={name}
          className="fixed top-14 right-4 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow text-sm"
        >
          Získal jsi: {name}
        </div>
      ))}
      <StoryNodeView gamebookId={gamebookId} node={node} choices={choices} />
    </>
  )
}
