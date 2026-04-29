'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PerformanceData } from '@/lib/performance/types'
import { useI18n } from '@/locales/client'

interface Props {
  data: PerformanceData | undefined
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ]
  return lines.join('\n')
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportButton({ data }: Props) {
  const t = useI18n()

  const exportSummary = () => {
    if (!data) return
    const s = data.summary
    downloadCsv('performance-summary.csv', toCsv([{
      trades: s.trades,
      winRate: s.winRate,
      totalPnl: s.totalPnl,
      avgPnl: s.avgPnl,
      profitFactor: s.profitFactor,
      avgRR: s.avgRR,
      maxDrawdown: s.maxDrawdown,
      bestTrade: s.bestTrade,
      worstTrade: s.worstTrade,
    }]))
  }

  const exportWinRate = () => {
    if (!data) return
    downloadCsv('win-rate-by-instrument.csv', toCsv(data.winRate.byInstrument))
  }

  const exportMaeMfe = () => {
    if (!data) return
    downloadCsv('mae-mfe.csv', toCsv(data.maeMfe.points))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!data}>
          <Download className="h-4 w-4 mr-2" />
          {t('performance.export.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportSummary}>{t('performance.export.summaryCSV')}</DropdownMenuItem>
        <DropdownMenuItem onClick={exportWinRate}>{t('performance.export.winRateCSV')}</DropdownMenuItem>
        <DropdownMenuItem onClick={exportMaeMfe}>{t('performance.export.maeMfeCSV')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
