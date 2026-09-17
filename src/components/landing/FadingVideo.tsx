'use client'

import React, { useEffect, useRef } from 'react'

/**
 * FadingVideo
 * -----------
 * Wraps an auto-playing muted <video> and implements a seamless crossfade
 * loop using requestAnimationFrame — NO CSS transitions, NO `loop` attribute.
 *
 * Behaviour (per cinematic landing spec):
 *   FADE_MS        = 500        // duration of every fade
 *   FADE_OUT_LEAD  = 0.55s      // start fading out this far before the end
 *
 *   fadeTo(target, duration)
 *     - reads current opacity from video.style.opacity (so each new fade
 *       resumes from wherever the last one left off)
 *     - cancels the previous rAF id before starting a new one
 *
 *   loadeddata  → set opacity 0, play(), fadeTo(1)
 *   timeupdate  → if !fadingOut && (duration - currentTime) <= 0.55 && > 0
 *                    → flip fadingOut ref, fadeTo(0)
 *   ended       → set opacity 0; after 100ms timeout: reset currentTime = 0,
 *                    play(), clear fadingOut, fadeTo(1)
 *
 * Cleanup on unmount: cancel rAF, remove listeners.
 */

interface FadingVideoProps
  extends React.VideoHTMLAttributes<HTMLVideoElement> {
  /** Fade duration in ms. Default 500. */
  fadeMs?: number
  /** Seconds before end to begin the fade-out. Default 0.55. */
  fadeOutLead?: number
}

const FADE_MS_DEFAULT = 500
const FADE_OUT_LEAD_DEFAULT = 0.55

export default function FadingVideo({
  fadeMs = FADE_MS_DEFAULT,
  fadeOutLead = FADE_OUT_LEAD_DEFAULT,
  className = '',
  style,
  src,
  ...videoProps
}: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const fadingOutRef = useRef<boolean>(false)
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Core rAF fade — reads current opacity from element style so each fade
  // resumes from wherever the previous one left off.
  const fadeTo = React.useCallback(
    (target: number, duration: number) => {
      const video = videoRef.current
      if (!video) return

      // Cancel any in-flight fade before starting a new one.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      const startOpacity =
        parseFloat(video.style.opacity || '0') || 0
      const delta = target - startOpacity
      const startTime = performance.now()

      const tick = (now: number) => {
        const elapsed = now - startTime
        const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1
        // easeOutQuad
        const eased = 1 - (1 - t) * (1 - t)
        const next = startOpacity + delta * eased
        video.style.opacity = String(next)

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          video.style.opacity = String(target)
          rafRef.current = null
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    },
    []
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onLoadedData = () => {
      video.style.opacity = '0'
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          /* autoplay can be blocked; ignore */
        })
      }
      fadeTo(1, fadeMs)
    }

    const onTimeUpdate = () => {
      const duration = video.duration
      const current = video.currentTime
      if (
        !fadingOutRef.current &&
        duration &&
        duration - current <= fadeOutLead &&
        duration - current > 0
      ) {
        fadingOutRef.current = true
        fadeTo(0, fadeMs)
      }
    }

    const onEnded = () => {
      video.style.opacity = '0'
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current)
      endTimeoutRef.current = setTimeout(() => {
        video.currentTime = 0
        const playPromise = video.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            /* ignore */
          })
        }
        fadingOutRef.current = false
        fadeTo(1, fadeMs)
      }, 100)
    }

    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)

    // ⚠ The video begins loading immediately (preload="auto") and on a fast
    // or cached load the `loadeddata` event can fire BEFORE this effect
    // attaches the listener — leaving opacity stuck at the initial 0.
    // If data is already available, kick off the fade-in now.
    if (video.readyState >= 2) {
      onLoadedData()
    }

    return () => {
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (endTimeoutRef.current) {
        clearTimeout(endTimeoutRef.current)
        endTimeoutRef.current = null
      }
    }
  }, [fadeMs, fadeOutLead, fadeTo])

  return (
    <video
      ref={videoRef}
      className={`space-video ${className}`}
      style={{ opacity: 0, ...style }}
      autoPlay
      muted
      playsInline
      preload="auto"
      src={typeof src === 'string' ? src : undefined}
      {...videoProps}
    />
  )
}
