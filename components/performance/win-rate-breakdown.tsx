'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PerformanceData, WinRateByDimension } from '@/lib/performance/types'
import { useI18n } from '@/locales/client'

interface Props {
  data: PerformanceData | undefined
  isLoading: boolean
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const money = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function WinRateBar({ value }: { value: number }) {
  const color = value >= 0.6 ? '#22c55e' : value >= 0.45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 rounded-full bg-muted w-24 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: pct(value), backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums">{pct(value)}</span>
    </div>
  )
}

function DimensionTable({ rows, title, noTradesLabel, tradesLabel }: {
  rows: WinRateByDimension[]
  title: string
  noTradesLabel: string
  tradesLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title}</TableHead>
              <TableHead className="text-right">{tradesLabel}</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
              <TableHead className="text-right">Avg P&L</TableHead>
              <TableHead className="text-right">Total P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {noTradesLabel}
                </TableCell>
              </TableRow>
            )}
            {rows.map(row => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.trades}</TableCell>
                <TableCell className="text-right">
                  <WinRateBar value={row.winRate} />
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums text-xs ${
                    row.avgPnl >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {money(row.avgPnl)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums text-xs font-semibold ${
                    row.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {money(row.totalPnl)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function WinRateBreakdown({ data, isLoading }: Props) {
  const t = useI18n()

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
        ))}
      </div>
    )
  }

  if (!data) return null

  const { overall, byInstrument, byWeekday, byHour, bySide } = data.winRate

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: t('performance.winRate.winRate'), value: pct(overall.winRate) },
          { label: t('performance.winRate.totalTrades'), value: String(overall.trades) },
          { label: t('performance.winRate.avgPnl'), value: money(overall.avgPnl) },
          { label: t('performance.winRate.totalPnl'), value: money(overall.totalPnl) },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekday bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('performance.winRate.byWeekday')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byWeekday} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => pct(v)} />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {byWeekday.map((entry, i) => (
                  <Cell key={i} fill={entry.winRate >= 0.5 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hour bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('performance.winRate.byHour')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byHour} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => pct(v)} />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {byHour.map((entry, i) => (
                  <Cell key={i} fill={entry.winRate >= 0.5 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <DimensionTable
          rows={byInstrument}
          title={t('performance.instrument')}
          noTradesLabel={t('performance.winRate.noTrades')}
          tradesLabel={t('performance.winRate.trades')}
        />
        <DimensionTable
          rows={bySide}
          title={t('performance.side')}
          noTradesLabel={t('performance.winRate.noTrades')}
          tradesLabel={t('performance.winRate.trades')}
        />
      </div>
    </div>
  )
}
