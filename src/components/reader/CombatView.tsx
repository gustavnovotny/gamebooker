'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSession } from '@/lib/reader/session'
import type { GameSession } from '@/lib/reader/session'
import type { Node, CombatConfig, Item, StatAttribute } from '@/lib/supabase/types'

// --- Exported pure functions (tested independently) ---

export interface CombatState {
  playerHp: number
  enemyHp: number
  playerRoundWins: number
  enemyRoundWins: number
  log: string[]
  phase: 'idle' | 'luck_prompt' | 'victory' | 'defeat'
  luckUsed: boolean
  pendingLoss: { damage: number } | null
}

export function computeItemBonus(inventory: Item[], attribute: StatAttribute): number {
  return inventory.reduce(
    (sum, item) => (item.stat_bonus_attribute === attribute ? sum + item.stat_bonus_value : sum),
    0,
  )
}

export function resolveRound(state: CombatState, playerRoll: number, enemyRoll: number): CombatState {
  if (playerRoll === enemyRoll) {
    return { ...state, log: [...state.log, `Remíza (${playerRoll} vs ${enemyRoll})`] }
  }

  if (playerRoll > enemyRoll) {
    const damage = Math.max(1, playerRoll - enemyRoll)
    const newEnemyHp = Math.max(0, state.enemyHp - damage)
    const newWins = state.playerRoundWins + 1
    const phase: CombatState['phase'] = newEnemyHp === 0 || newWins >= 2 ? 'victory' : 'idle'
    return {
      ...state,
      enemyHp: newEnemyHp,
      playerRoundWins: newWins,
      phase,
      log: [...state.log, `Výhra kola — nepřítel −${damage} HP`],
    }
  }

  // Player loses
  const damage = Math.max(1, enemyRoll - playerRoll)
  if (!state.luckUsed) {
    return {
      ...state,
      log: [...state.log, `Prohra kola (možná ztráta ${damage} HP)`],
      phase: 'luck_prompt',
      pendingLoss: { damage },
    }
  }

  const newPlayerHp = Math.max(0, state.playerHp - damage)
  const newWins = state.enemyRoundWins + 1
  const phase: CombatState['phase'] = newPlayerHp === 0 || newWins >= 2 ? 'defeat' : 'idle'
  return {
    ...state,
    playerHp: newPlayerHp,
    enemyRoundWins: newWins,
    phase,
    log: [...state.log, `Prohra kola — ty −${damage} HP`],
  }
}

export function resolveLuck(state: CombatState, luckRoll: number): CombatState {
  if (!state.pendingLoss) return state

  if (luckRoll >= 7) {
    return {
      ...state,
      log: [...state.log, `Štěstí: ${luckRoll} ≥ 7 — prohra se stala remízou!`],
      phase: 'idle',
      pendingLoss: null,
      luckUsed: true,
    }
  }

  const damage = state.pendingLoss.damage
  const newPlayerHp = Math.max(0, state.playerHp - damage)
  const newWins = state.enemyRoundWins + 1
  const phase: CombatState['phase'] = newPlayerHp === 0 || newWins >= 2 ? 'defeat' : 'idle'
  return {
    ...state,
    playerHp: newPlayerHp,
    enemyRoundWins: newWins,
    phase,
    pendingLoss: null,
    luckUsed: true,
    log: [...state.log, `Štěstí: ${luckRoll} < 7 — smůla`],
  }
}

// --- Component ---

interface Props {
  gamebookId: string
  node: Node
  combatConfig: CombatConfig
  session: GameSession
}

function d6() { return Math.floor(Math.random() * 6) + 1 }

const STAT_LABELS: Record<string, string> = {
  sila: 'Síla', inteligence: 'Inteligence', obratnost: 'Obratnost', stesti: 'Štěstí',
}

export default function CombatView({ gamebookId, node, combatConfig, session }: Props) {
  const router = useRouter()

  const [state, setState] = useState<CombatState>({
    playerHp: session.hp,
    enemyHp: combatConfig.enemy_hp,
    playerRoundWins: 0,
    enemyRoundWins: 0,
    log: [],
    phase: 'idle',
    luckUsed: false,
    pendingLoss: null,
  })

  if (!combatConfig.victory_node_id || !combatConfig.defeat_node_id) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <p className="text-red-600">Souboj není správně nakonfigurován.</p>
      </div>
    )
  }

  function handleRoll() {
    const playerStat = session.stats[combatConfig.player_attribute]
    const playerBonus = computeItemBonus(session.inventory, combatConfig.player_attribute as StatAttribute)
    const playerRoll = d6() + playerStat + playerBonus

    const enemyStatKey = `enemy_${combatConfig.enemy_attribute}` as keyof CombatConfig
    const enemyRoll = d6() + (combatConfig[enemyStatKey] as number)

    setState((prev) => resolveRound(prev, playerRoll, enemyRoll))
  }

  function handleTryLuck() {
    const stestiBonus = computeItemBonus(session.inventory, 'stesti')
    const luckRoll = d6() + session.stats.stesti + stestiBonus
    setState((prev) => resolveLuck(prev, luckRoll))
  }

  function handleSkipLuck() {
    setState((prev) => {
      if (!prev.pendingLoss) return prev
      const damage = prev.pendingLoss.damage
      const newPlayerHp = Math.max(0, prev.playerHp - damage)
      const newWins = prev.enemyRoundWins + 1
      const phase: CombatState['phase'] = newPlayerHp === 0 || newWins >= 2 ? 'defeat' : 'idle'
      return {
        ...prev,
        playerHp: newPlayerHp,
        enemyRoundWins: newWins,
        phase,
        pendingLoss: null,
        luckUsed: true,
        log: [...prev.log, `Ztraceno ${damage} HP`],
      }
    })
  }

  function handleContinue() {
    saveSession({ ...session, hp: state.playerHp })
    const targetId = state.phase === 'victory'
      ? combatConfig.victory_node_id!
      : combatConfig.defeat_node_id!
    router.push(`/hrat/${gamebookId}/uzel/${targetId}`)
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">{node.title}</h2>
        <p className="text-slate-600 text-sm">{node.content}</p>
      </div>

      {/* HP bars */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg border border-slate-200 bg-white">
          <p className="text-xs text-slate-500 mb-1">Ty</p>
          <p className="font-bold text-lg">{state.playerHp} HP</p>
          <p className="text-xs text-slate-400">{state.playerRoundWins} kol vyhráno</p>
        </div>
        <div className="p-3 rounded-lg border border-red-200 bg-red-50">
          <p className="text-xs text-slate-500 mb-1">{combatConfig.enemy_name}</p>
          <p className="font-bold text-lg">{state.enemyHp} HP</p>
          <p className="text-xs text-slate-400">{state.enemyRoundWins} kol vyhráno</p>
        </div>
      </div>

      {/* Combat log */}
      {state.log.length > 0 && (
        <ul className="text-sm text-slate-600 space-y-1 border-l-2 border-slate-200 pl-3">
          {state.log.map((entry, i) => <li key={i}>{entry}</li>)}
        </ul>
      )}

      {/* Actions */}
      {state.phase === 'idle' && (
        <button
          onClick={handleRoll}
          className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium"
        >
          Hodit kostky
        </button>
      )}

      {state.phase === 'luck_prompt' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Prohráváš kolo. Zkusíš štěstí? ({STAT_LABELS.stesti}: {session.stats.stesti})
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTryLuck}
              className="py-2 rounded-lg bg-amber-500 text-white font-medium text-sm"
            >
              Zkusit štěstí
            </button>
            <button
              onClick={handleSkipLuck}
              className="py-2 rounded-lg border border-slate-300 text-sm"
            >
              Přeskočit
            </button>
          </div>
        </div>
      )}

      {(state.phase === 'victory' || state.phase === 'defeat') && (
        <div className="space-y-3">
          <p className={`font-bold text-lg ${state.phase === 'victory' ? 'text-emerald-600' : 'text-red-600'}`}>
            {state.phase === 'victory' ? '⚔️ Vítězství!' : '💀 Prohra'}
          </p>
          <button
            onClick={handleContinue}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium"
          >
            Pokračovat
          </button>
        </div>
      )}
    </div>
  )
}
