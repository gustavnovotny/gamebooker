import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateGamebook } from '@/lib/validation/gamebook-validator'
import type { Node, Choice, CombatConfig } from '@/lib/supabase/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: gamebook } = await supabase
    .from('gamebooks')
    .select('id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!gamebook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all data for validation
  const nodeIdsResult = await supabase.from('nodes').select('id').eq('gamebook_id', id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeIdList = ((nodeIdsResult.data as any[]) ?? []).map((n) => n.id as string)

  const [{ data: rawNodes }, { data: rawCombatConfigs }] = await Promise.all([
    supabase.from('nodes').select('*').eq('gamebook_id', id),
    supabase.from('combat_configs').select('*').in('node_id', nodeIdList),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes = ((rawNodes as any[]) ?? []) as Node[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const combatConfigs = ((rawCombatConfigs as any[]) ?? []) as CombatConfig[]
  const nodeIds = nodes.map((n) => n.id)

  const { data: rawChoices } = await supabase
    .from('choices')
    .select('*')
    .in('from_node_id', nodeIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = ((rawChoices as any[]) ?? []) as Choice[]

  const validation = validateGamebook({ nodes, choices, combatConfigs })

  if (!validation.valid) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('gamebooks') as any)
    .update({ status: 'published' })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
