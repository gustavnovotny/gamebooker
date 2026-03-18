'use client'

import { useState } from 'react'
import type { GameSession } from '@/lib/reader/session'
import InventoryModal from './InventoryModal'

interface Props {
  session: GameSession
}

export default function SessionBar({ session }: Props) {
  const [showInventory, setShowInventory] = useState(false)

  return (
    <>
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-40">
        <span className="text-sm font-medium text-slate-700">
          Zdraví: {session.hp} / {session.maxHp}
        </span>
        <button
          onClick={() => setShowInventory(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Inventář ({session.inventory.length})
        </button>
      </div>
      {showInventory && (
        <InventoryModal items={session.inventory} onClose={() => setShowInventory(false)} />
      )}
    </>
  )
}
