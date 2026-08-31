'use client'

import { useState, useEffect } from 'react'

export interface UseCountUpOptions {
  duration?: number
  isCurrency?: boolean
  isPercent?: boolean
  decimals?: number
}

export function useCountUp(
  targetValue: number,
  options: UseCountUpOptions = {}
): string {
  const {
    duration = 800,
    isCurrency = false,
    isPercent = false,
    decimals = 0,
  } = options

  const [currentValue, setCurrentValue] = useState(0)

  useEffect(() => {
    // Check prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setCurrentValue(targetValue)
      return
    }

    let startTimestamp: number | null = null
    const startValue = 0

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)

      // Easing function (easeOutQuad)
      const easeProgress = 1 - (1 - progress) * (1 - progress)
      const nextValue = startValue + (targetValue - startValue) * easeProgress

      setCurrentValue(nextValue)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setCurrentValue(targetValue)
      }
    }

    const animationFrame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [targetValue, duration])

  if (isCurrency) {
    return (
      '$' +
      Math.round(currentValue)
        .toLocaleString('es-CO')
    )
  }

  if (isPercent) {
    return `${currentValue.toFixed(decimals)}%`
  }

  if (decimals > 0) {
    return currentValue.toLocaleString('es-CO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  return Math.round(currentValue).toLocaleString('es-CO')
}
