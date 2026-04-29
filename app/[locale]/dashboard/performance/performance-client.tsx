'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WinRateBreakdown } from '@/components/performance/win-rate-breakdown'
import { MaeMfePanel } from '@/components/performance/mae-mfe-panel'
import { DrawdownPanel } from '@/components/performance/drawdown-panel'
import { PeriodComparison } from '@/components/performance/period-comparison'
import { ExportButton } from '@/components/performance/export-button'
import { usePerformanceData } from '@/hooks/use-performance-data'
import { PeriodSelector } from '@/components/performance/period-selector'
import type { PeriodRange } from '@/lib/performance/types'
import { useI18n } from '@/locales/client'

export function PerformanceCenterClient() {
  const t = useI18n()
  const [period, setPeriod] = useState<PeriodRange>({ type: 'month', offset: 0 })
  const { data, isLoading, error } = usePerformanceData(period)

  if (error) {
    return (
      <div className="text-destructive text-sm p-4 border border-destructive/30 rounded-lg">
        {t('performance.error')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PeriodSelector value={period} onChange={setPeriod} />
        {data && <ExportButton data={data} />}
      </div>

      <Tabs defaultValue="winrate" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="winrate">{t('performance.tabs.winRate')}</TabsTrigger>
          <TabsTrigger value="maemfe">{t('performance.tabs.maeMfe')}</TabsTrigger>
          <TabsTrigger value="drawdown">{t('performance.tabs.drawdown')}</TabsTrigger>
          <TabsTrigger value="comparison">{t('performance.tabs.comparison')}</TabsTrigger>
        </TabsList>

        <TabsContent value="winrate">
          <WinRateBreakdown data={data} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="maemfe">
          <MaeMfePanel data={data} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="drawdown">
          <DrawdownPanel data={data} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="comparison">
          <PeriodComparison currentPeriod={period} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
