'use client'

import { X } from 'lucide-react'
import type { Item, StatAttribute } from '@/lib/supabase/types'

const STAT_LABELS: Record<StatAttribute, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
  stesti: 'Štěstí',
}

interface Props {
  items: Item[]
  onClose: () => void
}

export default function InventoryModal({ items, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Inventář</h2>
          <button aria-label="Zavřít" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-slate-400 italic text-sm">Žádné předměty.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-slate-200">
                <p className="font-medium text-sm">{item.name}</p>
                {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                {item.stat_bonus_attribute && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mt-1 inline-block">
                    +{item.stat_bonus_value} {STAT_LABELS[item.stat_bonus_attribute]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
