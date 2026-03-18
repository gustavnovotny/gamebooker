'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CombatConfig, CombatAttribute, Node } from '@/lib/supabase/types'
import { Save } from 'lucide-react'

interface CombatConfigFormProps {
  nodeId: string
  config: CombatConfig | null
  allNodes: Node[]
  onSave: (config: Omit<CombatConfig, 'id'> & { id?: string }) => void
}

const ATTRIBUTE_LABELS: Record<CombatAttribute, string> = {
  sila: 'Síla',
  inteligence: 'Inteligence',
  obratnost: 'Obratnost',
}

const COMBAT_ATTRIBUTES: CombatAttribute[] = ['sila', 'inteligence', 'obratnost']

export default function CombatConfigForm({ nodeId, config, allNodes, onSave }: CombatConfigFormProps) {
  const [enemyName, setEnemyName] = useState(config?.enemy_name ?? '')
  const [sila, setSila] = useState(config?.enemy_sila ?? 5)
  const [inteligence, setInteligence] = useState(config?.enemy_inteligence ?? 5)
  const [obratnost, setObratnost] = useState(config?.enemy_obratnost ?? 5)
  const [stesti, setStesti] = useState(config?.enemy_stesti ?? 5)
  const [hp, setHp] = useState(config?.enemy_hp ?? 20)
  const [playerAttr, setPlayerAttr] = useState<CombatAttribute>(config?.player_attribute ?? 'sila')
  const [enemyAttr, setEnemyAttr] = useState<CombatAttribute>(config?.enemy_attribute ?? 'sila')
  const [victoryNodeId, setVictoryNodeId] = useState(config?.victory_node_id ?? '')
  const [defeatNodeId, setDefeatNodeId] = useState(config?.defeat_node_id ?? '')

  function handleSave() {
    onSave({
      ...(config?.id ? { id: config.id } : {}),
      node_id: nodeId,
      enemy_name: enemyName,
      enemy_sila: sila,
      enemy_inteligence: inteligence,
      enemy_obratnost: obratnost,
      enemy_stesti: stesti,
      enemy_hp: hp,
      player_attribute: playerAttr,
      enemy_attribute: enemyAttr,
      victory_node_id: victoryNodeId || null,
      defeat_node_id: defeatNodeId || null,
    })
  }

  const otherNodes = allNodes.filter((n) => n.id !== nodeId)

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Konfigurace souboje</p>

      <div className="space-y-1">
        <Label htmlFor="enemy-name" className="text-xs">Název nepřítele</Label>
        <Input id="enemy-name" value={enemyName} onChange={(e) => setEnemyName(e.target.value)} placeholder="Goblin strážce…" className="text-sm" />
      </div>

      <div className="space-y-1">
        <p className="text-xs text-slate-500 font-medium">Statistiky nepřítele</p>
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            ['Síla', sila, setSila],
            ['Int.', inteligence, setInteligence],
            ['Obr.', obratnost, setObratnost],
            ['Štěstí', stesti, setStesti],
            ['HP', hp, setHp],
          ].map(([label, value, setter]) => (
            <div key={label as string} className="space-y-0.5">
              <p className="text-xs text-slate-400">{label as string}</p>
              <Input
                type="number"
                min={1}
                value={value as number}
                onChange={(e) => (setter as (v: number) => void)(Number(e.target.value))}
                className="text-xs text-center px-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Atribut hráče</Label>
          <div className="flex flex-col gap-1">
            {COMBAT_ATTRIBUTES.map((attr) => (
              <button
                key={attr}
                onClick={() => setPlayerAttr(attr)}
                className={`text-xs px-2 py-1 rounded border text-left transition-colors ${
                  playerAttr === attr
                    ? 'bg-indigo-100 border-indigo-400 text-indigo-800 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ATTRIBUTE_LABELS[attr]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Atribut nepřítele</Label>
          <div className="flex flex-col gap-1">
            {COMBAT_ATTRIBUTES.map((attr) => (
              <button
                key={attr}
                onClick={() => setEnemyAttr(attr)}
                className={`text-xs px-2 py-1 rounded border text-left transition-colors ${
                  enemyAttr === attr
                    ? 'bg-red-100 border-red-400 text-red-800 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ATTRIBUTE_LABELS[attr]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="victory-node" className="text-xs">Uzel při výhře</Label>
        <select
          id="victory-node"
          value={victoryNodeId}
          onChange={(e) => setVictoryNodeId(e.target.value)}
          className="w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">— nevybráno —</option>
          {otherNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.title}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="defeat-node" className="text-xs">Uzel při prohře</Label>
        <select
          id="defeat-node"
          value={defeatNodeId}
          onChange={(e) => setDefeatNodeId(e.target.value)}
          className="w-full text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">— nevybráno —</option>
          {otherNodes.map((n) => (
            <option key={n.id} value={n.id}>{n.title}</option>
          ))}
        </select>
      </div>

      <Button onClick={handleSave} variant="outline" className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Uložit konfiguraci souboje
      </Button>
    </div>
  )
}
