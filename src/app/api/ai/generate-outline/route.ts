import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/llm/factory'
import {
  OUTLINE_SYSTEM_PROMPT,
  OutlineSchema,
  buildOutlinePrompt,
} from '@/lib/llm/prompts/generate-outline'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyFoundation } = await request.json() as { storyFoundation: string }

  const provider = getProvider()
  const raw = await provider.chat([
    { role: 'system', content: OUTLINE_SYSTEM_PROMPT },
    { role: 'user', content: buildOutlinePrompt(storyFoundation) },
  ], { temperature: 0.7 })

  let parsed
  try {
    parsed = OutlineSchema.parse(JSON.parse(raw))
  } catch {
    return NextResponse.json(
      { error: 'AI vrátila neplatnou strukturu. Zkuste to prosím znovu.' },
      { status: 422 }
    )
  }

  return NextResponse.json(parsed)
}
