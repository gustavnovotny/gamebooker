'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Sparkles } from 'lucide-react'
import type { OutlineData } from '@/lib/llm/prompts/generate-outline'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface BrainstormChatProps {
  gamebookId: string
  onOutlineGenerated: (outline: OutlineData) => void
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Ahoj! Jsem tvůj AI asistent pro tvorbu gamebooků. Řekni mi o svém příběhu – jaké prostředí nebo žánr tě zajímá?',
}

export default function BrainstormChat({ gamebookId, onOutlineGenerated }: BrainstormChatProps) {
  const [history, setHistory] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingOutline, setGeneratingOutline] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newHistory = [...history, userMessage]
    setHistory(newHistory)
    setInput('')
    setLoading(true)

    // Skip index 0 (the initial greeting) — it is not part of the real conversation
    const conversationHistory = newHistory.slice(1)

    const res = await fetch('/api/ai/brainstorm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: conversationHistory }),
    })

    const { message } = await res.json()
    setHistory((prev) => [...prev, { role: 'assistant', content: message }])
    setLoading(false)
  }

  async function generateOutline() {
    setGeneratingOutline(true)
    const storyFoundation = history
      .filter((m) => m.role !== 'assistant' || m !== INITIAL_MESSAGE)
      .map((m) => `${m.role === 'user' ? 'Tvůrce' : 'AI'}: ${m.content}`)
      .join('\n')

    const res = await fetch('/api/ai/generate-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyFoundation }),
    })

    if (res.ok) {
      const outline = await res.json()
      onOutlineGenerated(outline)
    }
    setGeneratingOutline(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI Asistent
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={generateOutline}
          disabled={generatingOutline || history.length < 4}
        >
          {generatingOutline ? 'Generuji osnovu…' : 'Vygenerovat osnovu'}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {history.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-3 py-2 text-sm text-slate-500">
              Přemýšlím…
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Napiš o svém příběhu…"
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
