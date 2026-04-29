'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { PerformanceData } from '@/lib/performance/types'
import { useI18n } from '@/locales/client'

interface Props {
  data: PerformanceData | undefined
  isLoading: boolean
}

const money = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

export function MaeMfePanel({ data, isLoading }: Props) {
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

  const { points, avgMae, avgMfe, avgEfficiency, avgRR } = data.maeMfe

  const scatterData = points.map(p => ({
    x: p.mae,
    y: p.mfe,
    pnl: p.pnl,
    name: p.instrument,
  }))

  const efficiencyData = points.map(p => ({
    x: p.mfe,
    y: p.pnl,
    efficiency: p.efficiency,
    name: p.instrument,
  }))

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: t('performance.maeMfe.avgMAE'), value: money(avgMae), note: t('performance.maeMfe.maxAdverseExcursion') },
          { label: t('performance.maeMfe.avgMFE'), value: money(avgMfe), note: t('performance.maeMfe.maxFavorableExcursion') },
          { label: t('performance.maeMfe.avgEfficiency'), value: pct(avgEfficiency), note: t('performance.maeMfe.pnlMfe') },
          { label: t('performance.maeMfe.avgRR'), value: avgRR.toFixed(2), note: t('performance.maeMfe.riskRewardRatio') },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {points.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            {t('performance.maeMfe.noData')}<br />
            <span className="text-xs">{t('performance.maeMfe.noDataNote')}</span>
          </CardContent>
        </Card>
      )}

      {points.length > 0 && (
        <>
          {/* MAE vs MFE scatter */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('performance.maeMfe.scatterTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="x"
                    name={t('performance.maeMfe.mae')}
                    type="number"
                    tickFormatter={money}
                    tick={{ fontSize: 11 }}
                    label={{ value: `${t('performance.maeMfe.mae')} ($)`, position: 'insideBottom', offset: -4, fontSize: 12 }}
                  />
                  <YAxis
                    dataKey="y"
                    name={t('performance.maeMfe.mfe')}
                    type="number"
                    tickFormatter={money}
                    tick={{ fontSize: 11 }}
                    label={{ value: `${t('performance.maeMfe.mfe')} ($)`, angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-background border rounded-lg shadow p-2 text-xs">
                          <p className="font-medium">{d.name}</p>
                          <p>{t('performance.maeMfe.mae')}: {money(d.x)}</p>
                          <p>{t('performance.maeMfe.mfe')}: {money(d.y)}</p>
                          <p>{t('performance.maeMfe.pnl')}: {money(d.pnl)}</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={scatterData}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.7}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Efficiency scatter: MFE vs P&L */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('performance.maeMfe.efficiencyTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="x"
                    name={t('performance.maeMfe.mfe')}
                    type="number"
                    tickFormatter={money}
                    tick={{ fontSize: 11 }}
                    label={{ value: `${t('performance.maeMfe.mfe')} ($)`, position: 'insideBottom', offset: -4, fontSize: 12 }}
                  />
                  <YAxis
                    dataKey="y"
                    name={t('performance.maeMfe.pnl')}
                    type="number"
                    tickFormatter={money}
                    tick={{ fontSize: 11 }}
                    label={{ value: `${t('performance.maeMfe.pnl')} ($)`, angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <ReferenceLine stroke="#6b7280" strokeDasharray="4 4" segment={[{ x: 0, y: 0 }, { x: 10000, y: 10000 }]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-background border rounded-lg shadow p-2 text-xs">
                          <p className="font-medium">{d.name}</p>
                          <p>{t('performance.maeMfe.mfe')}: {money(d.x)}</p>
                          <p>{t('performance.maeMfe.pnl')}: {money(d.y)}</p>
                          <p>{t('performance.maeMfe.efficiency')}: {pct(d.efficiency)}</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter data={efficiencyData} fill="#8b5cf6" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
