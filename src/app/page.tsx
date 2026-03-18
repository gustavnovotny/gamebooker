import { createClient } from '@/lib/supabase/server'
import GamebookCard from '@/components/library/GamebookCard'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Gamebooker — Čti a hraj gamebooky' }

export default async function LibraryPage() {
  const supabase = await createClient()

  // Fetch published gamebooks with node counts
  const { data: gamebooks } = await supabase
    .from('gamebooks')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // Fetch node counts for all published gamebooks
  const nodeCounts: Record<string, number> = {}
  if (gamebooks && gamebooks.length > 0) {
    const { data: counts } = await supabase
      .from('nodes')
      .select('gamebook_id')
      .in('gamebook_id', gamebooks.map((g) => g.id))

    counts?.forEach(({ gamebook_id }) => {
      nodeCounts[gamebook_id] = (nodeCounts[gamebook_id] ?? 0) + 1
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg text-slate-900">Gamebooker</span>
          </div>
          <Link
            href="/prihlasit"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 text-sm font-medium transition-colors"
          >
            Přihlásit se jako tvůrce
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-4xl font-bold text-slate-900">
          Čti a hraj gamebooky
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Interaktivní příběhy, kde ty rozhoduješ. Vytvoř vlastní nebo si zahraj ty od ostatních.
        </p>
      </section>

      {/* Library grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        {!gamebooks || gamebooks.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Zatím žádné gamebooky. Buď první!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {gamebooks.map((gamebook) => (
              <GamebookCard
                key={gamebook.id}
                gamebook={gamebook}
                nodeCount={nodeCounts[gamebook.id] ?? 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
