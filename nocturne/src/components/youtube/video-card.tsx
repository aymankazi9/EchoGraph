'use client'

import type { VideoResult } from '@/lib/youtube/search'

interface Props {
  video: VideoResult
}

export function VideoCard({ video }: Props) {
  const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}`

  return (
    <div className="flex gap-2.5 py-2 border-b border-border-subtle last:border-b-0">
      {/* Thumbnail */}
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
        aria-label={`Watch ${video.title} on YouTube`}
      >
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            width={120}
            height={68}
            className="rounded-card object-cover bg-bg-overlay"
            style={{ width: '120px', height: '68px' }}
          />
        ) : (
          <div
            className="rounded-card bg-bg-overlay flex items-center justify-center"
            style={{ width: '120px', height: '68px' }}
          >
            <span className="text-caption text-text-tertiary">No preview</span>
          </div>
        )}
      </a>

      {/* Metadata */}
      <div className="flex flex-col justify-between min-w-0 py-0.5">
        <p className="text-body-sm text-text-primary leading-snug line-clamp-2">
          {video.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-caption text-text-tertiary truncate">{video.channelName}</span>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 ml-2"
          >
            Watch ↗
          </a>
        </div>
      </div>
    </div>
  )
}
