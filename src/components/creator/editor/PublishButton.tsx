'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Globe, AlertCircle } from 'lucide-react'

interface PublishButtonProps {
  gamebookId: string
  currentStatus: string
  onPublished: () => void
}

export default function PublishButton({
  gamebookId,
  currentStatus,
  onPublished,
}: PublishButtonProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function handlePublish() {
    setLoading(true)
    setErrors([])

    const res = await fetch(`/api/gamebooks/${gamebookId}/publish`, {
      method: 'POST',
    })

    if (res.ok) {
      onPublished()
    } else {
      const data = await res.json()
      setErrors(data.errors ?? ['Nepodařilo se publikovat gamebook.'])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePublish}
        disabled={loading || currentStatus === 'published'}
        variant={currentStatus === 'published' ? 'outline' : 'default'}
      >
        <Globe className="w-4 h-4 mr-2" />
        {loading ? 'Publikuji…' : currentStatus === 'published' ? 'Publikováno' : 'Publikovat'}
      </Button>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1 text-red-700 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Před publikováním opravte tyto chyby:
          </div>
          <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
