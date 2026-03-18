'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSession } from '@/lib/reader/session'
import type { GameSession } from '@/lib/reader/session'

const POOL = 5
const BASE = 5

const STAT_LABELS: Record<string, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
  stesti: 'Štěstí',
}

type Stats = GameSession['stats']

interface Props {
  gamebookId: string
  startNodeId: string
  gamebookTitle: string
}

export default function CharacterCreation({ gamebookId, startNodeId, gamebookTitle }: Props) {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({ sila: BASE, inteligence: BASE, obratnost: BASE, stesti: BASE })

  const spent = stats.sila + stats.inteligence + stats.obratnost + stats.stesti - BASE * 4
  const pool = POOL - spent

  function add(attr: keyof Stats) {
    if (pool <= 0) return
    setStats((prev) => ({ ...prev, [attr]: prev[attr] + 1 }))
  }

  function remove(attr: keyof Stats) {
    if (stats[attr] <= BASE) return
    setStats((prev) => ({ ...prev, [attr]: prev[attr] - 1 }))
  }

  function handleStart() {
    const maxHp = stats.sila + 10
    const session: GameSession = {
      gamebookId,
      currentNodeId: startNodeId,
      hp: maxHp,
      maxHp,
      stats,
      inventory: [],
    }
    saveSession(session)
    router.push(`/hrat/${gamebookId}/uzel/${startNodeId}`)
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">{gamebookTitle}</h1>
      <p className="text-slate-500 mb-6">Nastav svého hrdinu</p>
      <p className="text-sm font-medium mb-4">Zbývá bodů: {pool}</p>

      <div className="space-y-3 mb-4">
        {(Object.keys(stats) as Array<keyof Stats>).map((attr) => (
          <div key={attr} className="flex items-center justify-between">
            <span className="text-sm font-medium w-32">{STAT_LABELS[attr]}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => remove(attr)}
                disabled={stats[attr] <= BASE}
                className="w-7 h-7 rounded border text-lg leading-none disabled:opacity-40"
              >−</button>
              <span className="w-6 text-center font-mono">{stats[attr]}</span>
              <button
                onClick={() => add(attr)}
                disabled={pool <= 0}
                className="w-7 h-7 rounded border text-lg leading-none disabled:opacity-40"
              >+</button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mb-6">Zdraví: {stats.sila + 10} HP</p>

      <button
        onClick={handleStart}
        disabled={pool !== 0}
        className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50"
      >
        Začít hrát
      </button>
    </div>
  )
}
