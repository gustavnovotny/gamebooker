export type NodeType = 'story' | 'combat' | 'item_discovery' | 'ending'
export type GamebookStatus = 'draft' | 'published'
export type StatAttribute = 'sila' | 'inteligence' | 'obratnost' | 'stesti'
export type CombatAttribute = 'sila' | 'inteligence' | 'obratnost'

export interface Gamebook {
  id: string
  creator_id: string
  creator_display_name: string
  title: string
  description: string
  cover_image_url: string | null
  genre: string | null
  status: GamebookStatus
  created_at: string
  updated_at: string
}

export interface Node {
  id: string
  gamebook_id: string
  type: NodeType
  title: string
  summary: string
  content: string
  is_start: boolean
  x: number
  y: number
}

export interface Choice {
  id: string
  from_node_id: string
  to_node_id: string
  text: string
  condition_item_id: string | null
}

export interface Item {
  id: string
  gamebook_id: string
  name: string
  description: string
  stat_bonus_attribute: StatAttribute | null
  stat_bonus_value: number
}

export interface NodeItem {
  node_id: string
  item_id: string
}

export interface CombatConfig {
  id: string
  node_id: string
  enemy_name: string
  enemy_sila: number
  enemy_inteligence: number
  enemy_obratnost: number
  enemy_stesti: number
  enemy_hp: number
  player_attribute: CombatAttribute
  enemy_attribute: CombatAttribute
  victory_node_id: string | null
  defeat_node_id: string | null
}

export interface Database {
  public: {
    Tables: {
      gamebooks: { Row: Gamebook; Insert: Omit<Gamebook, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Gamebook, 'id'>>; Relationships: [] }
      nodes: { Row: Node; Insert: Omit<Node, 'id'>; Update: Partial<Omit<Node, 'id'>>; Relationships: [] }
      choices: { Row: Choice; Insert: Omit<Choice, 'id'>; Update: Partial<Omit<Choice, 'id'>>; Relationships: [] }
      items: { Row: Item; Insert: Omit<Item, 'id'>; Update: Partial<Omit<Item, 'id'>>; Relationships: [] }
      node_items: { Row: NodeItem; Insert: NodeItem; Update: NodeItem; Relationships: [] }
      combat_configs: { Row: CombatConfig; Insert: Omit<CombatConfig, 'id'>; Update: Partial<Omit<CombatConfig, 'id'>>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
