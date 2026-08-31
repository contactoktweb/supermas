'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ScrollableTabsProps {
  children: React.ReactNode
  className?: string
  role?: string
}

export function ScrollableTabs({
  children,
  className = '',
  role = 'tablist',
}: ScrollableTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const hasOverflow = el.scrollWidth > el.clientWidth + 2
    const isAtStart = el.scrollLeft <= 4
    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4

    setCanScrollLeft(hasOverflow && !isAtStart)
    setCanScrollRight(hasOverflow && !isAtEnd)
  }, [])

  useEffect(() => {
    checkScrollability()
    window.addEventListener('resize', checkScrollability)
    return () => window.removeEventListener('resize', checkScrollability)
  }, [checkScrollability])

  // Also check when children change or active tab updates
  useEffect(() => {
    const timer = setTimeout(checkScrollability, 100)
    return () => clearTimeout(timer)
  }, [children, checkScrollability])

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -180, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 180, behavior: 'smooth' })
    }
  }

  return (
    <div className="scrollable-tabs-container">
      {/* Left Navigation Arrow */}
      {canScrollLeft && (
        <button
          type="button"
          className="tabs-scroll-btn left-arrow page-enter"
          onClick={scrollLeft}
          title="Desplazar pestañas a la izquierda"
          aria-label="Desplazar pestañas a la izquierda"
        >
          <AppIcon name="chevronLeft" size={14} />
        </button>
      )}

      {/* Tabs Viewport */}
      <div
        ref={scrollRef}
        className={`drawer-tabs ${className}`}
        role={role}
        onScroll={checkScrollability}
      >
        {children}
      </div>

      {/* Right Navigation Arrow */}
      {canScrollRight && (
        <button
          type="button"
          className="tabs-scroll-btn right-arrow page-enter"
          onClick={scrollRight}
          title="Desplazar pestañas a la derecha"
          aria-label="Desplazar pestañas a la derecha"
        >
          <AppIcon name="chevronRight" size={14} />
        </button>
      )}
    </div>
  )
}
