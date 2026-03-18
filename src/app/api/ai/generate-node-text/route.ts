import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/llm/factory'
import {
  NODE_TEXT_SYSTEM_PROMPT,
  buildNodeTextPrompt,
} from '@/lib/llm/prompts/generate-node-text'
import type { NodeTextContext } from '@/lib/llm/prompts/generate-node-text'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const context = await request.json() as NodeTextContext

  const provider = getProvider()
  const stream = provider.stream([
    { role: 'system', content: NODE_TEXT_SYSTEM_PROMPT },
    { role: 'user', content: buildNodeTextPrompt(context) },
  ])

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
