'use client'

import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'

interface PublishButtonProps {
  gamebookId: string
  currentStatus: string
  onPublished: () => void
}

export default function PublishButton({ gamebookId, currentStatus, onPublished }: PublishButtonProps) {
  return (
    <Button disabled={currentStatus === 'published'} variant="outline" size="sm">
      <Globe className="w-4 h-4 mr-2" />
      {currentStatus === 'published' ? 'Publikováno' : 'Publikovat'}
    </Button>
  )
}
