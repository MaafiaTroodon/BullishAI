'use client'

import { useEffect, useRef } from 'react'
import { useInViewAnimation } from '@/hooks/useInViewAnimation'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  as?: keyof JSX.IntrinsicElements
}

export function AnimateOnScroll({ as = 'div', children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useInViewAnimation(ref.current)
  const As: any = as
  return (
    <As ref={ref} {...rest}>
      {children}
    </As>
  )
}


