import Link from 'next/link'
import { Layers } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center">
      <Layers size={48} strokeWidth={1.0} className="text-text-tertiary mb-5" />

      <h2 className="text-subheading font-medium text-text-primary mb-2">
        Your vault is empty
      </h2>
      <p className="text-body-sm text-text-secondary max-w-[360px] leading-relaxed mb-6">
        Start by uploading your lecture slides, recording, or study guide. EchoGraph adapts
        to whatever you have.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/session/new"
          className="inline-flex h-9 px-5 items-center rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors"
        >
          New session
        </Link>
        <Link
          href="/session/new"
          className="inline-flex h-9 px-5 items-center rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
        >
          Import Anki deck
        </Link>
      </div>

      <p className="text-caption text-text-tertiary">
        Your files are encrypted before upload. We cannot read them.
      </p>
    </div>
  )
}
