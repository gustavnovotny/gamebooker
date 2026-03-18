import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { Gamebook } from '@/lib/supabase/types'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GamebookListProps {
  gamebooks: Gamebook[]
}

export default function GamebookList({ gamebooks }: GamebookListProps) {
  if (gamebooks.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Zatím žádné gamebooky. Vytvořte svůj první!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {gamebooks.map((gamebook) => (
        <div
          key={gamebook.id}
          className="flex items-center justify-between p-4 bg-white rounded-xl border hover:shadow-sm transition-shadow"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{gamebook.title}</span>
              <Badge variant={gamebook.status === 'published' ? 'default' : 'secondary'}>
                {gamebook.status === 'published' ? 'Publikováno' : 'Koncept'}
              </Badge>
              {gamebook.genre && (
                <Badge variant="outline" className="text-xs">{gamebook.genre}</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 line-clamp-1">{gamebook.description}</p>
          </div>
          <Link
            href={`/tvorit/${gamebook.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Upravit
          </Link>
        </div>
      ))}
    </div>
  )
}
