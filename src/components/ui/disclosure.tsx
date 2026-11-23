import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ControlChevron } from '@/components/ui/control-chevron'
import { cn } from '@/lib/utils'

type DisclosureProps = {
  label: ReactNode
  children: ReactNode
  className?: string
  defaultOpen?: boolean
  variant?: 'ghost' | 'outline'
  triggerClassName?: string
}

export function Disclosure({ label, variant = 'ghost', className, triggerClassName, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  return <Collapsible className={className} open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild>
      <Button type="button" variant={variant} className={cn('h-auto min-h-control max-w-full justify-start text-start whitespace-normal', triggerClassName)}>
        <span className="min-w-0 break-words">{label}</span>
        <ControlChevron />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent forceMount className="disclosure-content">
      <div className="disclosure-grid">
        <div className="disclosure-body" inert={!open}>{children}</div>
      </div>
    </CollapsibleContent>
  </Collapsible>
}
