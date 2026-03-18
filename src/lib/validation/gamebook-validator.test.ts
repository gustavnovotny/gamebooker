import { validateGamebook } from './gamebook-validator'
import type { Node, Choice, CombatConfig } from '@/lib/supabase/types'

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'n1',
    gamebook_id: 'g1',
    type: 'story',
    title: 'Test',
    content: 'Some content',
    is_start: false,
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('validateGamebook', () => {
  it('passes for a minimal valid gamebook', () => {
    const start = makeNode({ id: 'start', is_start: true })
    const end = makeNode({ id: 'end', type: 'ending' })
    const choices: Choice[] = [{
      id: 'c1', from_node_id: 'start', to_node_id: 'end',
      text: 'Pokračuj', condition_item_id: null,
    }]
    const result = validateGamebook({ nodes: [start, end], choices, combatConfigs: [] })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when there is no start node', () => {
    const nodes = [makeNode({ type: 'ending' })]
    const result = validateGamebook({ nodes, choices: [], combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('startovní uzel'))).toBe(true)
  })

  it('fails when there are multiple start nodes', () => {
    const nodes = [
      makeNode({ id: 'a', is_start: true }),
      makeNode({ id: 'b', is_start: true, type: 'ending' }),
    ]
    const result = validateGamebook({ nodes, choices: [], combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('startovní uzel'))).toBe(true)
  })

  it('fails when a non-ending node has no outgoing choices', () => {
    const start = makeNode({ id: 'start', is_start: true, type: 'story' })
    const result = validateGamebook({ nodes: [start], choices: [], combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('slepá ulička'))).toBe(true)
  })

  it('fails when a combat node has no combat config', () => {
    const start = makeNode({ id: 'start', is_start: true, type: 'combat' })
    const end = makeNode({ id: 'end', type: 'ending' })
    const choices: Choice[] = [{
      id: 'c1', from_node_id: 'start', to_node_id: 'end',
      text: 'Pokračuj', condition_item_id: null,
    }]
    const result = validateGamebook({ nodes: [start, end], choices, combatConfigs: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('combat'))).toBe(true)
  })

  it('fails when a combat config is missing victory or defeat node', () => {
    const start = makeNode({ id: 'start', is_start: true, type: 'combat' })
    const end = makeNode({ id: 'end', type: 'ending' })
    const choices: Choice[] = [{
      id: 'c1', from_node_id: 'start', to_node_id: 'end',
      text: 'Pokračuj', condition_item_id: null,
    }]
    const combatConfig: CombatConfig = {
      id: 'cc1', node_id: 'start', enemy_name: 'Drak',
      enemy_sila: 5, enemy_inteligence: 3, enemy_obratnost: 4, enemy_stesti: 2,
      enemy_hp: 15, player_attribute: 'sila', enemy_attribute: 'sila',
      victory_node_id: null, defeat_node_id: null,
    }
    const result = validateGamebook({ nodes: [start, end], choices, combatConfigs: [combatConfig] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('výhra') || e.includes('prohra'))).toBe(true)
  })
})
