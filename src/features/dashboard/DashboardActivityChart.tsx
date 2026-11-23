import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { ActivityDay } from './dashboardData'

const chartConfig = {
  items: { label: 'Items added', color: 'var(--chart-1)' },
} satisfies ChartConfig

export default function DashboardActivityChart({ series }: { series: ActivityDay[] }) {
  return <ChartContainer config={chartConfig} className="h-52 w-full min-w-0 overflow-hidden sm:h-64">
    <AreaChart accessibilityLayer data={series} margin={{ top: 8, right: 28, bottom: 0, left: -12 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)' }} tickMargin={9} minTickGap={24} interval="preserveStartEnd" />
      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)' }} width={38} tickCount={5} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
      <Area
        dataKey="items"
        type="linear"
        fill="var(--color-items)"
        fillOpacity={0.22}
        stroke="var(--color-items)"
        strokeWidth={2}
        isAnimationActive={false}
      />
    </AreaChart>
  </ChartContainer>
}
