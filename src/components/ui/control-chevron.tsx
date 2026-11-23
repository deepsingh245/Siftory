import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ControlChevron({ className, ...props }: ComponentProps<typeof ChevronDown>) {
  return <ChevronDown data-slot="control-chevron" className={cn('size-4 shrink-0 text-muted-foreground', className)} aria-hidden="true" {...props} />
}
