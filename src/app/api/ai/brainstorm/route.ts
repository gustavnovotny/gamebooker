import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/llm/factory'
import { buildBrainstormMessages } from '@/lib/llm/prompts/brainstorm-conversation'
import type { BrainstormMessage } from '@/lib/llm/prompts/brainstorm-conversation'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { history } = await request.json() as { history: BrainstormMessage[] }

  const provider = getProvider()
  const messages = buildBrainstormMessages(history)
  const response = await provider.chat(messages, { temperature: 0.8 })

  return NextResponse.json({ message: response })
}
