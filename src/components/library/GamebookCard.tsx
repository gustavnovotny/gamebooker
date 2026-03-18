import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import type { Gamebook } from '@/lib/supabase/types'
import { BookOpen } from 'lucide-react'

interface GamebookCardProps {
  gamebook: Gamebook
  nodeCount: number
}

export default function GamebookCard({ gamebook, nodeCount }: GamebookCardProps) {
  return (
    <Card className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Cover image */}
      <div className="relative aspect-[3/2] bg-indigo-50">
        {gamebook.cover_image_url ? (
          <Image
            src={gamebook.cover_image_url}
            alt={gamebook.title}
            fill
            className="object-cover"
          />
        ) : (
          <div
            data-testid="cover-placeholder"
            className="absolute inset-0 flex items-center justify-center"
          >
            <BookOpen className="w-12 h-12 text-indigo-200" />
          </div>
        )}
      </div>

      <CardContent className="flex-1 pt-4 space-y-2">
        {gamebook.genre && (
          <Badge variant="secondary" className="text-xs">
            {gamebook.genre}
          </Badge>
        )}
        <h2 className="font-bold text-slate-900 line-clamp-2 leading-snug">
          {gamebook.title}
        </h2>
        <p className="text-sm text-slate-500 line-clamp-2">{gamebook.description}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{gamebook.creator_display_name}</span>
          <span>·</span>
          <span>{nodeCount} uzlů</span>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Link
          href={`/hrat/${gamebook.id}`}
          className="inline-flex items-center justify-center w-full rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-sm font-medium transition-colors"
        >
          Hrát
        </Link>
      </CardFooter>
    </Card>
  )
}
