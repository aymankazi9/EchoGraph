'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { vaultLogout } from '@/lib/crypto/vault'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  email: string
  collapsed?: boolean
}

export function UserRow({ email, collapsed }: Props) {
  const router = useRouter()
  const initial = email.charAt(0).toUpperCase()
  const displayEmail = email.length > 24 ? email.slice(0, 24) + '…' : email

  async function handleLogout() {
    const supabase = createClient()
    await vaultLogout(supabase)
    router.push('/')
  }

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-col items-center gap-3">
          {/* Avatar — shows which account is active */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center cursor-default shrink-0">
                <span className="text-caption font-medium text-indigo-400">{initial}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{email}</TooltipContent>
          </Tooltip>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                className="w-7 h-7 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
              >
                <LogOut size={14} strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2">
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
        <span className="text-caption font-medium text-indigo-400">{initial}</span>
      </div>

      {/* Email */}
      <span className="text-caption text-text-secondary truncate flex-1 min-w-0">
        {displayEmail}
      </span>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Sign out"
        className="w-7 h-7 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors shrink-0"
      >
        <LogOut size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
