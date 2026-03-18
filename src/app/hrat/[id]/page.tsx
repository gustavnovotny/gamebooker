import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HratPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: gamebook } = await supabase
    .from('gamebooks')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!gamebook) notFound()

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold">{gamebook.title}</h1>
      <p className="text-slate-500">{gamebook.description}</p>
      {/* Plan 3 fills this out */}
    </main>
  )
}
