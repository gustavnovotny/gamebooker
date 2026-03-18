import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Moje gamebooky — Gamebooker' }

export default async function TvoritPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900">Moje gamebooky</h1>
      <p className="text-slate-500 mt-1">Přihlášen jako {user?.email}</p>
      {/* Plan 2 fills this out */}
    </main>
  )
}
