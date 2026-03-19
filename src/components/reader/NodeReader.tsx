'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, saveSession } from '@/lib/reader/session'
import type { Node, Choice, Item, CombatConfig } from '@/lib/supabase/types'
import SessionBar from './SessionBar'
import StoryNodeView from './StoryNodeView'
import ItemDiscoveryNodeView from './ItemDiscoveryNodeView'
import CombatView from './CombatView'
import EndingView from './EndingView'

interface Props {
  gamebookId: string
  node: Node
  choices: Choice[]
  combatConfig: CombatConfig | null
  assignedItems: Item[]
}

export default function NodeReader({ gamebookId, node, choices, combatConfig, assignedItems }: Props) {
  const router = useRouter()
  const session = getSession(gamebookId)

  useEffect(() => {
    if (!session) {
      router.replace(`/hrat/${gamebookId}`)
      return
    }
    if (session.currentNodeId !== node.id) {
      saveSession({ ...session, currentNodeId: node.id })
    }
  }, [node.id, gamebookId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null

  return (
    <div className="min-h-screen bg-slate-50 pt-12">
      <SessionBar session={session} />

      {node.type === 'story' && (
        <StoryNodeView gamebookId={gamebookId} node={node} choices={choices} />
      )}

      {node.type === 'item_discovery' && (
        <ItemDiscoveryNodeView
          gamebookId={gamebookId}
          node={node}
          choices={choices}
          assignedItems={assignedItems}
          session={session}
        />
      )}

      {node.type === 'combat' && combatConfig && (
        <CombatView
          gamebookId={gamebookId}
          node={node}
          combatConfig={combatConfig}
          session={session}
        />
      )}

      {node.type === 'ending' && (
        <EndingView gamebookId={gamebookId} node={node} />
      )}
    </div>
  )
}
