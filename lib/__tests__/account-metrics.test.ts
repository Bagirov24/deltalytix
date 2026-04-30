import { describe, it, expect } from 'vitest'
import { computeAccountMetrics, computeMetricsForAccounts } from '../account-metrics'
import type { Account } from '@/context/data-provider'
import type { Trade as PrismaTrade } from '@/prisma/generated/prisma/browser'

// ─── Factories ────────────────────────────────────────────────────────────────

const mkAccount = (overrides: Partial<Account> = {}): Account =>
  ({
    id: 'acc-1',
    number: 'A1',
    name: 'Test Account',
    startingBalance: 50_000,
    profitTarget: 3_000,
    drawdownThreshold: 2_000,
    trailingDrawdown: false,
    trailingStopProfit: null,
    consistencyPercentage: 30,
    resetDate: null,
    payouts: [],
    buffer: 0,
    considerBuffer: true,
    minPnlToCountAsDay: 0,
    groupId: null,
    propfirmId: null,
    ...overrides,
  } as unknown as Account)

const mkTrade = (
  accountNumber: string,
  pnl: number,
  opts: { entryDate?: string; commission?: number } = {}
): PrismaTrade =>
  ({
    id: `t-${Math.random()}`,
    accountNumber,
    entryDate: opts.entryDate ?? '2024-01-15T09:00:00Z',
    closeDate: opts.entryDate ?? '2024-01-15T10:00:00Z',
    pnl,
    commission: opts.commission ?? 0,
    instrument: 'NQ',
    side: 'LONG',
    timeInPosition: 30,
  } as unknown as PrismaTrade)

// ─── computeAccountMetrics — P&L and balance ──────────────────────────────────

describe('computeAccountMetrics — balance', () => {
  it('currentBalance = startingBalance + sum of net pnl', () => {
    const acc = mkAccount({ startingBalance: 50_000 })
    const trades = [
      mkTrade('A1', 500),
      mkTrade('A1', -200),
      mkTrade('A1', 100),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.currentBalance).toBeCloseTo(50_400)
  })

  it('deducts commission from pnl before adding to balance', () => {
    const acc = mkAccount({ startingBalance: 50_000 })
    const trades = [mkTrade('A1', 500, { commission: 50 })]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.currentBalance).toBeCloseTo(50_450)
  })

  it('returns startingBalance when no trades', () => {
    const acc = mkAccount({ startingBalance: 50_000 })
    const { metrics } = computeAccountMetrics(acc, [])
    expect(metrics.currentBalance).toBe(50_000)
  })

  it('ignores trades from other accounts', () => {
    const acc = mkAccount({ startingBalance: 50_000 })
    const trades = [
      mkTrade('A1', 1_000),
      mkTrade('OTHER', 9_999),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.currentBalance).toBeCloseTo(51_000)
  })

  it('deducts paid/validated payouts from currentBalance', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      payouts: [
        { id: 'p1', amount: 1_000, date: '2024-01-20T00:00:00Z', status: 'PAID', propfirmSharingPercentage: null },
        { id: 'p2', amount: 500,   date: '2024-01-21T00:00:00Z', status: 'PENDING', propfirmSharingPercentage: null },
      ],
    })
    const trades = [mkTrade('A1', 2_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    // PENDING payout should NOT be deducted
    expect(metrics.currentBalance).toBeCloseTo(50_000 + 2_000 - 1_000)
  })

  it('totalProfit counts net pnl across all filtered trades', () => {
    const acc = mkAccount({ startingBalance: 50_000 })
    const trades = [
      mkTrade('A1', 300),
      mkTrade('A1', -100),
      mkTrade('A1', 200, { commission: 20 }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    // 300 + (-100) + (200-20) = 380
    expect(metrics.totalProfit).toBeCloseTo(380)
  })
})

// ─── computeAccountMetrics — progress ────────────────────────────────────────

describe('computeAccountMetrics — progress', () => {
  it('progress is 0% when no profit', () => {
    const acc = mkAccount({ startingBalance: 50_000, profitTarget: 3_000 })
    const { metrics } = computeAccountMetrics(acc, [])
    expect(metrics.progress).toBe(0)
  })

  it('progress is 100% when profit equals target', () => {
    const acc = mkAccount({ startingBalance: 50_000, profitTarget: 3_000 })
    const trades = [mkTrade('A1', 3_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.progress).toBeCloseTo(100)
  })

  it('progress can exceed 100%', () => {
    const acc = mkAccount({ startingBalance: 50_000, profitTarget: 1_000 })
    const trades = [mkTrade('A1', 2_500)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.progress).toBeCloseTo(250)
  })

  it('remainingToTarget decreases as profit grows', () => {
    const acc = mkAccount({ startingBalance: 50_000, profitTarget: 3_000 })
    const trades = [mkTrade('A1', 1_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.remainingToTarget).toBeCloseTo(2_000)
  })

  it('remainingToTarget is 0 when target exceeded', () => {
    const acc = mkAccount({ startingBalance: 50_000, profitTarget: 1_000 })
    const trades = [mkTrade('A1', 5_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.remainingToTarget).toBe(0)
  })
})

// ─── computeAccountMetrics — drawdown ────────────────────────────────────────

describe('computeAccountMetrics — drawdown (static)', () => {
  it('drawdownLevel = startingBalance - drawdownThreshold', () => {
    const acc = mkAccount({ startingBalance: 50_000, drawdownThreshold: 2_000, trailingDrawdown: false })
    const { metrics } = computeAccountMetrics(acc, [])
    expect(metrics.drawdownLevel).toBe(48_000)
  })

  it('remainingLoss = currentBalance - drawdownLevel', () => {
    const acc = mkAccount({ startingBalance: 50_000, drawdownThreshold: 2_000, trailingDrawdown: false })
    const trades = [mkTrade('A1', 500)]
    const { metrics } = computeAccountMetrics(acc, trades)
    // currentBalance = 50500, drawdownLevel = 48000 → remainingLoss = 2500
    expect(metrics.remainingLoss).toBeCloseTo(2_500)
  })

  it('remainingLoss clamps to 0 when balance drops below drawdownLevel', () => {
    const acc = mkAccount({ startingBalance: 50_000, drawdownThreshold: 2_000, trailingDrawdown: false })
    const trades = [mkTrade('A1', -4_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.remainingLoss).toBe(0)
  })

  it('drawdownProgress is 100% when remainingLoss = 0 (drawdown limit hit)', () => {
    const acc = mkAccount({ startingBalance: 50_000, drawdownThreshold: 2_000, trailingDrawdown: false })
    const trades = [mkTrade('A1', -5_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.drawdownProgress).toBe(100)
  })
})

describe('computeAccountMetrics — drawdown (trailing)', () => {
  it('drawdownLevel trails the highest balance', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      drawdownThreshold: 2_000,
      trailingDrawdown: true,
      trailingStopProfit: null,
    })
    // highest balance = 50_000 + 1_500 = 51_500 → drawdownLevel = 51_500 - 2_000 = 49_500
    const trades = [
      mkTrade('A1', 1_500, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', -500, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.drawdownLevel).toBe(49_500)
    expect(metrics.highestBalance).toBe(51_500)
  })

  it('locks drawdownLevel at trailingStopProfit once reached', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      drawdownThreshold: 2_000,
      trailingDrawdown: true,
      trailingStopProfit: 1_000,
    })
    // profitMade = 2_000 ≥ trailingStopProfit=1_000 → lock at startingBalance + trailingStopProfit - threshold
    // = 50_000 + 1_000 - 2_000 = 49_000
    const trades = [mkTrade('A1', 2_000)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.drawdownLevel).toBe(49_000)
  })
})

// ─── computeAccountMetrics — consistency ─────────────────────────────────────

describe('computeAccountMetrics — consistency', () => {
  it('isConsistent is true when no single day exceeds maxAllowedDailyProfit', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      profitTarget: 3_000,
      consistencyPercentage: 30,
    })
    // totalProfit=900 → maxAllowed = max(900,3000)*0.30 = 900 → highestProfitDay=300 ≤ 900
    const trades = [
      mkTrade('A1', 300, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 300, { entryDate: '2024-01-02T09:00:00Z' }),
      mkTrade('A1', 300, { entryDate: '2024-01-03T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.isConsistent).toBe(true)
  })

  it('isConsistent is false when a single day exceeds maxAllowedDailyProfit', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      profitTarget: 3_000,
      consistencyPercentage: 30,
    })
    // totalProfit = 2_900 ≤ target 3_000 → base = 3_000 → maxAllowed = 900
    // highestProfitDay = 2_800 > 900 → inconsistent
    const trades = [
      mkTrade('A1', 2_800, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 100,   { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.isConsistent).toBe(false)
  })

  it('maxAllowedDailyProfit is null when consistencyPercentage is 0', () => {
    const acc = mkAccount({ consistencyPercentage: 0 })
    const trades = [mkTrade('A1', 500)]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.maxAllowedDailyProfit).toBeNull()
  })

  it('highestProfitDay reflects same-day trade grouping', () => {
    const acc = mkAccount({})
    const trades = [
      mkTrade('A1', 200, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 350, { entryDate: '2024-01-01T14:00:00Z' }), // same day
      mkTrade('A1', 100, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.highestProfitDay).toBeCloseTo(550)
  })
})

// ─── computeAccountMetrics — reset date ───────────────────────────────────────

describe('computeAccountMetrics — resetDate', () => {
  it('excludes trades before resetDate', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      resetDate: '2024-02-01T00:00:00Z',
    })
    const trades = [
      mkTrade('A1', 5_000, { entryDate: '2024-01-15T09:00:00Z' }), // before reset
      mkTrade('A1', 500,   { entryDate: '2024-02-10T09:00:00Z' }), // after reset
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.totalProfit).toBeCloseTo(500)
    expect(metrics.currentBalance).toBeCloseTo(50_500)
  })

  it('includes all trades when resetDate is null', () => {
    const acc = mkAccount({ startingBalance: 50_000, resetDate: null })
    const trades = [
      mkTrade('A1', 500, { entryDate: '2020-01-01T09:00:00Z' }),
      mkTrade('A1', 500, { entryDate: '2024-06-01T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.totalProfit).toBeCloseTo(1_000)
  })
})

// ─── computeAccountMetrics — trading days ────────────────────────────────────

describe('computeAccountMetrics — trading days', () => {
  it('totalTradingDays counts unique entry dates', () => {
    const acc = mkAccount({})
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 200, { entryDate: '2024-01-01T14:00:00Z' }), // same day
      mkTrade('A1', 150, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.totalTradingDays).toBe(2)
  })

  it('validTradingDays excludes days below minPnlToCountAsDay', () => {
    const acc = mkAccount({ minPnlToCountAsDay: 50 })
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }), // 100 >= 50 → valid
      mkTrade('A1', 20,  { entryDate: '2024-01-02T09:00:00Z' }), // 20 < 50 → invalid
      mkTrade('A1', -30, { entryDate: '2024-01-03T09:00:00Z' }), // negative → invalid
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.totalTradingDays).toBe(3)
    expect(metrics.validTradingDays).toBe(1)
  })

  it('validTradingDays equals totalTradingDays when minPnlToCountAsDay is 0', () => {
    const acc = mkAccount({ minPnlToCountAsDay: 0 })
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 50,  { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { metrics } = computeAccountMetrics(acc, trades)
    expect(metrics.validTradingDays).toBe(metrics.totalTradingDays)
  })
})

// ─── computeAccountMetrics — buffer filtering ────────────────────────────────

describe('computeAccountMetrics — buffer', () => {
  it('excludes trades below buffer threshold', () => {
    const acc = mkAccount({
      startingBalance: 50_000,
      buffer: 500,
      considerBuffer: true,
    })
    // Trades: +100, +200, +300 → cumulative: 100, 300, 600
    // First two trades are below 500 threshold, third crosses it
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 200, { entryDate: '2024-01-02T09:00:00Z' }),
      mkTrade('A1', 300, { entryDate: '2024-01-03T09:00:00Z' }),
    ]
    const { trades: filteredTrades } = computeAccountMetrics(acc, trades)
    // Only the trade that crosses the buffer should be included
    expect(filteredTrades.length).toBeLessThan(3)
  })

  it('buffer=0 includes all trades', () => {
    const acc = mkAccount({ startingBalance: 50_000, buffer: 0, considerBuffer: true })
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 200, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { trades: filteredTrades } = computeAccountMetrics(acc, trades)
    expect(filteredTrades.length).toBe(2)
  })

  it('considerBuffer=false bypasses buffer logic', () => {
    const acc = mkAccount({ startingBalance: 50_000, buffer: 5_000, considerBuffer: false })
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 200, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { trades: filteredTrades } = computeAccountMetrics(acc, trades)
    expect(filteredTrades.length).toBe(2)
  })
})

// ─── computeAccountMetrics — daily metrics ───────────────────────────────────

describe('computeAccountMetrics — dailyMetrics', () => {
  it('produces one daily entry per unique trade date', () => {
    const acc = mkAccount({})
    const trades = [
      mkTrade('A1', 100, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 200, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { dailyMetrics } = computeAccountMetrics(acc, trades)
    expect(dailyMetrics).toHaveLength(2)
  })

  it('totalBalance tracks running balance across days', () => {
    const acc = mkAccount({ startingBalance: 50_000 })
    const trades = [
      mkTrade('A1', 500, { entryDate: '2024-01-01T09:00:00Z' }),
      mkTrade('A1', 300, { entryDate: '2024-01-02T09:00:00Z' }),
    ]
    const { dailyMetrics } = computeAccountMetrics(acc, trades)
    expect(dailyMetrics[0].totalBalance).toBeCloseTo(50_500)
    expect(dailyMetrics[1].totalBalance).toBeCloseTo(50_800)
  })
})

// ─── computeMetricsForAccounts ────────────────────────────────────────────────

describe('computeMetricsForAccounts', () => {
  it('processes multiple accounts independently', () => {
    const acc1 = mkAccount({ id: 'a1', number: 'A1', startingBalance: 50_000 })
    const acc2 = mkAccount({ id: 'a2', number: 'A2', startingBalance: 25_000 })
    const trades = [
      mkTrade('A1', 1_000),
      mkTrade('A2', 500),
    ]
    const result = computeMetricsForAccounts([acc1, acc2], trades)
    expect(result).toHaveLength(2)
    expect(result.find(a => a.number === 'A1')!.metrics!.currentBalance).toBeCloseTo(51_000)
    expect(result.find(a => a.number === 'A2')!.metrics!.currentBalance).toBeCloseTo(25_500)
  })

  it('each account only sees its own trades', () => {
    const acc1 = mkAccount({ id: 'a1', number: 'A1', startingBalance: 50_000 })
    const acc2 = mkAccount({ id: 'a2', number: 'A2', startingBalance: 10_000 })
    const trades = [mkTrade('A1', 9_999)] // only for A1
    const result = computeMetricsForAccounts([acc1, acc2], trades)
    expect(result.find(a => a.number === 'A2')!.metrics!.totalProfit).toBe(0)
  })
})
