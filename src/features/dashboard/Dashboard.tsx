import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, Files, Inbox, LibraryBig, ListChecks, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ControlChevron } from '@/components/ui/control-chevron'
import { Disclosure } from '@/components/ui/disclosure'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { routeHref } from '../../app/routes'
import { displayTitle } from '../../domain/library'
import type { SavedItem, SourceType } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'
import { activityRanges, dashboardSnapshot, libraryActivity } from './dashboardData'
import type { ActivityRange } from './dashboardData'

const ActivityChart = lazy(() => import('./DashboardActivityChart'))
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const numberFormat = new Intl.NumberFormat()
const sourceLabels: Record<SourceType, string> = {
  website: 'Website', youtube: 'YouTube', instagram: 'Instagram', reddit: 'Reddit', x: 'X',
  tiktok: 'TikTok', pinterest: 'Pinterest', bookmark: 'Bookmark', pdf: 'PDF', document: 'Document',
  image: 'Image', text: 'Text file', other: 'Other',
}
const statusLabels: Record<SavedItem['status'], string> = { inbox: 'Inbox', saved: 'Saved', archived: 'Archived' }

type Metric = {
  label: string
  count: number
  description: string
  icon: LucideIcon
  href?: string
  action?: string
}

function DashboardMetric({ label, count, description, icon: Icon, href, action }: Metric) {
  return <Card className="min-w-0 gap-0 py-0">
    <CardHeader className="gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <CardDescription className="text-sm font-medium">{label}</CardDescription>
        <span className="shrink-0 rounded-md bg-primary/10 p-1.5 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <CardTitle className="text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums">
        {numberFormat.format(count)}
      </CardTitle>
      <p className="text-sm leading-snug text-muted-foreground">{description}</p>
    </CardHeader>
    {href && <CardContent className="flex items-center border-t px-4 py-2 sm:px-5">
      <Button asChild size="sm" variant="link" className="h-auto min-h-8 p-0 text-foreground">
        <a href={href} className="gap-2">{action}<ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
      </Button>
    </CardContent>}
  </Card>
}

function LoadingDashboard() {
  return <div aria-busy="true" aria-label="Loading dashboard" className="space-y-5">
    <p role="status" className="sr-only">Loading dashboard</p>
    <div aria-hidden="true" className="grid gap-3 @min-[21rem]:grid-cols-2 @4xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)}
    </div>
    <Skeleton aria-hidden="true" className="h-72 w-full rounded-xl" />
  </div>
}

function LibraryActivity({ items }: { items: SavedItem[] }) {
  const [range, setRange] = useState<ActivityRange>(30)
  const series = useMemo(() => libraryActivity(items, range), [items, range])
  const activeDays = series.filter((day) => day.items > 0)
  const total = activeDays.reduce((sum, day) => sum + day.items, 0)
  return <Card className="min-w-0" role="region" aria-labelledby="activity-heading">
    <CardHeader className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id="activity-heading" className="leading-none font-semibold">Library activity</h2>
        <CardDescription>Local items by the date they were added.</CardDescription>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" aria-label={`Activity date range, Last ${range} days`}>
            Last {range} days <ControlChevron />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuRadioGroup value={String(range)} onValueChange={(value) => {
            const next = activityRanges.find((days) => String(days) === value)
            if (next) setRange(next)
          }}>
            {activityRanges.map((days) => <DropdownMenuRadioItem key={days} value={String(days)} className="min-h-9">Last {days} days</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent className="min-w-0">
      {total ? <>
        <p className="sr-only" role="status">{total} {total === 1 ? 'item' : 'items'} added in the last {range} days.</p>
        <Suspense fallback={<Skeleton className="h-52 w-full sm:h-64" />}>
          <ActivityChart series={series} />
        </Suspense>
        <Disclosure className="mt-3 border-t pt-2 text-sm" label="View daily counts">
          <dl className="mt-2 grid gap-x-6 gap-y-1 @sm:grid-cols-2">
            {activeDays.map(({ date, label, items }) => <div key={date} className="flex justify-between gap-3">
              <dt><time dateTime={date}>{label}</time></dt>
              <dd className="tabular-nums">{items}</dd>
            </div>)}
          </dl>
        </Disclosure>
      </> : <div className="grid min-h-32 place-content-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
        <Files className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
        <p role="status" className="text-sm text-muted-foreground">No items added in the last {range} days.</p>
      </div>}
    </CardContent>
  </Card>
}

function RecentItems({ items }: { items: SavedItem[] }) {
  return <Card className="min-w-0" role="region" aria-labelledby="recent-heading">
    <CardHeader className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id="recent-heading" className="leading-none font-semibold">Recent items</h2>
        <CardDescription>The most recent additions to your library.</CardDescription>
      </div>
      {items.length > 0 && <Button asChild size="sm" variant="outline">
        <a href={routeHref({ page: 'library' })}>All saved <ArrowRight aria-hidden="true" /></a>
      </Button>}
    </CardHeader>
    <CardContent className="min-w-0">
      {items.length ? <div className="min-w-0 overflow-hidden rounded-lg border">
        <Table className="table-fixed" aria-labelledby="recent-heading">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead scope="col">Item</TableHead>
              <TableHead scope="col" className="hidden w-28 @2xl:table-cell">Source</TableHead>
              <TableHead scope="col" className="hidden w-32 @xl:table-cell">Added</TableHead>
              <TableHead scope="col" className="w-23 @xl:w-26">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const date = new Date(item.createdAt)
              const hasDate = Number.isFinite(date.getTime())
              const source = sourceLabels[item.sourceType]
              return <TableRow key={item.id}>
                <TableCell className="py-3 whitespace-normal">
                  <a className="rounded-sm font-medium text-foreground [overflow-wrap:anywhere] hover:underline" href={routeHref({ page: 'item', id: item.id })}>
                    {displayTitle(item)}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground @2xl:hidden">{source}</p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground @2xl:table-cell">{source}</TableCell>
                <TableCell className="hidden text-muted-foreground @xl:table-cell">
                  {hasDate ? <time dateTime={item.createdAt}>{dateFormat.format(date)}</time> : 'Unknown date'}
                </TableCell>
                <TableCell>
                  <Badge variant={item.status === 'inbox' ? 'secondary' : 'outline'}>{statusLabels[item.status]}</Badge>
                </TableCell>
              </TableRow>
            })}
          </TableBody>
        </Table>
      </div> : <div className="grid min-h-28 place-content-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
        <LibraryBig className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Add a source to start building your library.</p>
      </div>}
    </CardContent>
  </Card>
}

export function Dashboard({ data }: { data: LibraryData }) {
  const { items, jobs, analysisJobs } = data
  const stats = useMemo(() => dashboardSnapshot({ items, jobs, analysisJobs }), [items, jobs, analysisJobs])
  const metrics: Metric[] = [
    {
      label: 'Library items', count: stats.itemCount, description: 'Stored on this device', icon: LibraryBig,
      href: routeHref({ page: 'library' }), action: 'Open library',
    },
    {
      label: 'Inbox', count: stats.inboxCount, description: 'Waiting for review', icon: Inbox,
      href: routeHref({ page: 'inbox' }), action: 'Open Inbox',
    },
    {
      label: 'With transcripts', count: stats.transcriptCount, description: 'Items with an attached transcript', icon: ScrollText,
    },
    {
      label: 'Needs attention', count: stats.attentionCount,
      description: stats.activeJobs ? `${stats.activeJobs} ${stats.activeJobs === 1 ? 'job' : 'jobs'} queued or running` : 'No queued or running jobs',
      icon: ListChecks, href: routeHref({ page: 'queue' }), action: 'Processing queue',
    },
  ]
  return <PageLayout className="@container" title="Dashboard" description="Review recent saves and see what needs your attention." actions={
      <Button asChild>
        <a href={routeHref({ page: 'import' })}><ArrowDownToLine aria-hidden="true" /> Import sources</a>
      </Button>
  }>
    {data.loading ? <LoadingDashboard /> : data.error ? <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold"><AlertCircle className="size-4" aria-hidden="true" /> The library could not be opened</h2>
        <CardDescription role="alert">{data.error}</CardDescription>
      </CardHeader>
      <CardContent><Button type="button" variant="outline" onClick={() => void data.refresh()}>Retry</Button></CardContent>
    </Card> : <>
      <section aria-label="Library summary" className="grid min-w-0 gap-3 @min-[21rem]:grid-cols-2 @4xl:grid-cols-4">
        {metrics.map((metric) => <DashboardMetric key={metric.label} {...metric} />)}
      </section>
      <LibraryActivity items={data.items} />
      <RecentItems items={stats.recent} />
    </>}
  </PageLayout>
}
