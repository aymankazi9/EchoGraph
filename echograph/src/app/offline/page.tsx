import { WifiOff } from 'lucide-react'
import { TryAgainButton } from './try-again-button'

export default function OfflinePage() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-bg-base px-6 text-center">
      <WifiOff size={40} strokeWidth={1.25} className="text-text-tertiary" />

      <h1 className="text-subheading font-medium text-text-primary mt-3">
        You&rsquo;re offline
      </h1>

      <p className="text-body-sm text-text-secondary max-w-[360px] mt-3 leading-relaxed">
        EchoGraph requires an internet connection to decrypt and sync your vault.
        Your encrypted files are safe — connect to continue studying.
      </p>

      <div className="flex flex-col gap-1 mt-4">
        <p className="text-caption text-text-tertiary">· Your files are not affected by being offline</p>
        <p className="text-caption text-text-tertiary">· Reconnect to access your vault</p>
      </div>

      <TryAgainButton />

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-caption text-text-tertiary select-none">
        EchoGraph
      </p>
    </div>
  )
}
