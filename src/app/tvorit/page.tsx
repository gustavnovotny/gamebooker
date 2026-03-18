import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GamebookList from '@/components/creator/dashboard/GamebookList'
import CreateGamebookButton from '@/components/creator/dashboard/CreateGamebookButton'
import { BookOpen, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Moje gamebooky — Gamebooker' }

export default async function TvoritPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/prihlasit')

  const { data: gamebooks } = await supabase
    .from('gamebooks')
    .select('*')
    .eq('creator_id', user!.id)
    .order('updated_at', { ascending: false })

  const displayName = user!.email?.split('@')[0] ?? 'Tvůrce'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg text-slate-900">Gamebooker</span>
            <span className="text-slate-400 text-sm ml-2">Tvůrce</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user!.email}</span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Moje gamebooky</h1>
          <CreateGamebookButton
            creatorDisplayName={displayName}
            creatorId={user!.id}
          />
        </div>
        <GamebookList gamebooks={gamebooks ?? []} />
      </main>
    </div>
  )
}
