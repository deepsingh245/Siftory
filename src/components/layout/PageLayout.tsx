import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageLayoutProps = Omit<ComponentProps<'section'>, 'title'> & {
  title: string
  description?: ReactNode
  context?: ReactNode
  actions?: ReactNode
}

export function PageLayout({ title, description, context, actions, children, className, ...props }: PageLayoutProps) {
  const headingId = useId()

  return <section {...props} aria-labelledby={headingId} className={cn('workspace-page', className)}>
    <header className="page-header">
      {context && <div className="page-context">{context}</div>}
      <div className="page-heading">
        <div className="min-w-0">
          <h1 id={headingId} className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
    {children}
  </section>
}
