'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

interface CreateGamebookButtonProps {
  creatorDisplayName: string
  creatorId: string
}

export default function CreateGamebookButton({ creatorDisplayName, creatorId }: CreateGamebookButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!title.trim()) {
      setError('Zadejte název gamebooku.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('gamebooks')
      .insert({
        title: title.trim(),
        creator_id: creatorId,
        creator_display_name: creatorDisplayName,
        description: '',
        status: 'draft',
      })
      .select('id')
      .single()

    if (error || !data) {
      setError('Nepodařilo se vytvořit gamebook. Zkuste to znovu.')
      setLoading(false)
      return
    }

    setOpen(false)
    router.push(`/tvorit/${data.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nový gamebook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vytvořit nový gamebook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Název</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Záhadný hrad"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Vytvářím…' : 'Vytvořit a začít'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
