'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * BlurText
 * --------
 * Word-by-word blur-in headline.
 *
 * - IntersectionObserver triggers when ≥10% of the element is visible.
 * - Splits the supplied text by spaces into motion.span words.
 * - Each word animates through a 3-step keyframe:
 *     blur(10px) opacity 0 y 50
 *     → blur(5px) opacity 0.5 y -5
 *     → blur(0px) opacity 1 y 0
 *   duration 0.7s, times [0, 0.5, 1], ease easeOut
 * - Stagger: delay = (i * 100) / 1000 seconds
 * - Parent <p> is flex / flex-wrap / justify-center with rowGap 0.1em
 * - Each word is inline-block with marginRight 0.28em (NOT nbsp — letter-
 *   spacing -4px eats nbsp)
 */
interface BlurTextProps {
  text: string
  className?: string
  /** Visibility ratio that triggers the animation. Default 0.1. */
  threshold?: number
}

export default function BlurText({
  text,
  className = '',
  threshold = 0.1,
}: BlurTextProps) {
  const containerRef = useRef<HTMLParagraphElement | null>(null)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // If IntersectionObserver is unavailable (SSR / very old browser),
    // fall back to animating on the next microtask so we don't call
    // setState synchronously inside the effect body.
    if (typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => setShouldAnimate(true))
      return
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldAnimate(true)
            observerRef.current?.disconnect()
          }
        })
      },
      { threshold }
    )
    observerRef.current.observe(el)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [threshold])

  const words = text.split(' ')

  return (
    <p
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        rowGap: '0.1em',
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          style={{
            display: 'inline-block',
            marginRight: '0.28em',
          }}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
          animate={
            shouldAnimate
              ? {
                  filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
                  opacity: [0, 0.5, 1],
                  y: [50, -5, 0],
                }
              : { filter: 'blur(10px)', opacity: 0, y: 50 }
          }
          transition={{
            duration: 0.7,
            times: [0, 0.5, 1],
            ease: 'easeOut',
            delay: (i * 100) / 1000,
          }}
        >
          {word}
        </motion.span>
      ))}
    </p>
  )
}
