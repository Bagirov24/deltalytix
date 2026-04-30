import { describe, it, expect } from 'vitest'
import { computeEquityChartData } from '../equity-chart'
import type {
  EquityChartTradeInput,
  EquityChartAccountInput,
  EquityChartGroupInput,
  EquityChartParams,
} from '../equity-chart'

// ─── Factories ────────────────────────────────────────────────────────────────

const mkTrade = (
  accountNumber: string,
  pnl: number,
  date = '2024-01-15',
  opts: Partial<EquityChartTradeInput> = {}
): EquityChartTradeInput => ({
  entryDate: `${date}T10:00:00Z`,
  accountNumber,
  instrument: 'NQ',
  pnl,
  commission: 0,
  timeInPosition: 30,
  tags: [],
  ...opts,
})

const mkAccount = (number: string, overrides: Partial<EquityChartAccountInput> = {}): EquityChartAccountInput => ({
  number,
  groupId: null,
  startingBalance: 50_000,
  resetDate: null,
  payouts: [],
  ...overrides,
})

const mkGroup = (id: string, name: string, accounts: string[]): EquityChartGroupInput => ({
  id,
  name,
  accounts: accounts.map(n => ({ number: n })),
})

const defaultParams = (overrides: Partial<EquityChartParams> = {}): EquityChartParams => ({
  instruments: [],
  accountNumbers: [],
  dateRange: undefined,
  pnlRange: {},
  tickRange: {},
  timeRange: { range: null },
  tickFilter: { value: null },
  weekdayFilter: { days: [] },
  hourFilter: { hour: null },
  tagFilter: { tags: [] },
  timezone: 'UTC',
  showIndividual: false,
  maxAccounts: 10,
  dataSampling: 'all',
  selectedAccounts: [],
  ...overrides,
})

// ─── Empty / edge cases ───────────────────────────────────────────────────────

describe('computeEquityChartData — empty input', () => {
  it('returns empty result when no trades', () => {
    const result = computeEquityChartData([], [mkAccount('A1')], [], defaultParams())
    expect(result.chartData).toHaveLength(0)
    expect(result.accountNumbers).toHaveLength(0)
    expect(result.dateRange.startDate).toBe('')
    expect(result.dateRange.endDate).toBe('')
  })

  it('returns empty result when all trades belong to hidden accounts', () => {
    const hiddenGroup = mkGroup('g-hidden', 'Hidden Accounts', ['A1'])
    const acc = mkAccount('A1', { groupId: 'g-hidden' })
    const trades = [mkTrade('A1', 500)]
    const result = computeEquityChartData(trades, [acc], [hiddenGroup], defaultParams())
    expect(result.chartData).toHaveLength(0)
  })
})

// ─── Aggregated equity (showIndividual: false) ────────────────────────────────

describe('computeEquityChartData — aggregated equity', () => {
  it('accumulates pnl across dates', () => {
    const acc = mkAccount('A1')
    const trades = [
      mkTrade('A1', 100, '2024-01-10'),
      mkTrade('A1', 200, '2024-01-11'),
      mkTrade('A1', -50, '2024-01-12'),
    ]
    const result = computeEquityChartData(trades, [acc], [], defaultParams())
    // Find equity at each date
    const pts = result.chartData
    const day10 = pts.find(p => p.date === '2024-01-10')!
    const day11 = pts.find(p => p.date === '2024-01-11')!
    const day12 = pts.find(p => p.date === '2024-01-12')!
    expect(day10.equity).toBeCloseTo(100)
    expect(day11.equity).toBeCloseTo(300)
    expect(day12.equity).toBeCloseTo(250)
  })

  it('subtracts commission from equity', () => {
    const acc = mkAccount('A1')
    const trades = [mkTrade('A1', 500, '2024-01-10', { commission: 50 })]
    const result = computeEquityChartData(trades, [acc], [], defaultParams())
    const pt = result.chartData.find(p => p.date === '2024-01-10')!
    expect(pt.equity).toBeCloseTo(450)
  })

  it('produces correct date range in result', () => {
    const acc = mkAccount('A1')
    const trades = [
      mkTrade('A1', 100, '2024-02-01'),
      mkTrade('A1', 200, '2024-02-05'),
    ]
    const result = computeEquityChartData(trades, [acc], [], defaultParams())
    expect(result.dateRange.startDate).toBe('2024-02-01')
    expect(result.dateRange.endDate).toBe('2024-02-05')
  })

  it('aggregates multiple accounts into single equity line', () => {
    const trades = [
      mkTrade('A1', 300, '2024-01-10'),
      mkTrade('A2', 200, '2024-01-10'),
    ]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1'), mkAccount('A2')],
      [],
      defaultParams()
    )
    const pt = result.chartData.find(p => p.date === '2024-01-10')!
    expect(pt.equity).toBeCloseTo(500)
  })
})

// ─── Individual equity (showIndividual: true) ─────────────────────────────────

describe('computeEquityChartData — individual mode', () => {
  it('produces equity_{accountNumber} key per account', () => {
    const trades = [mkTrade('A1', 300, '2024-01-10')]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1')],
      [],
      defaultParams({ showIndividual: true })
    )
    const pt = result.chartData.find(p => p.date === '2024-01-10')!
    expect(pt['equity_A1']).toBeCloseTo(300)
  })

  it('equity_{account} is undefined before first activity', () => {
    const trades = [mkTrade('A1', 300, '2024-01-10')]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1')],
      [],
      defaultParams({ showIndividual: true })
    )
    // There should be a point before Jan 10 if end extends past start
    const before = result.chartData.find(p => p.date < '2024-01-10')
    if (before) {
      expect(before['equity_A1']).toBeUndefined()
    }
  })

  it('respects maxAccounts limit', () => {
    const trades = [
      mkTrade('A1', 100, '2024-01-10'),
      mkTrade('A2', 100, '2024-01-10'),
      mkTrade('A3', 100, '2024-01-10'),
    ]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1'), mkAccount('A2'), mkAccount('A3')],
      [],
      defaultParams({ showIndividual: true, maxAccounts: 2 })
    )
    // Only 2 accounts should have equity_ keys populated
    const pt = result.chartData.find(p => p.date === '2024-01-10')!
    const definedKeys = Object.keys(pt).filter(
      k => k.startsWith('equity_') && pt[k as `equity_${string}`] !== undefined
    )
    expect(definedKeys.length).toBeLessThanOrEqual(2)
  })
})

// ─── Filters ──────────────────────────────────────────────────────────────────

describe('computeEquityChartData — filters', () => {
  it('accountNumbers filter restricts to selected accounts', () => {
    const trades = [
      mkTrade('A1', 500, '2024-01-10'),
      mkTrade('A2', 999, '2024-01-10'),
    ]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1'), mkAccount('A2')],
      [],
      defaultParams({ showIndividual: true, accountNumbers: ['A1'] })
    )
    const pt = result.chartData.find(p => p.date === '2024-01-10')!
    expect(pt['equity_A1']).toBeCloseTo(500)
    expect(pt['equity_A2']).toBeUndefined()
  })

  it('pnlRange.min excludes trades below minimum', () => {
    const trades = [
      mkTrade('A1', 10,  '2024-01-10'),
      mkTrade('A1', 500, '2024-01-11'),
    ]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1')],
      [],
      defaultParams({ showIndividual: true, pnlRange: { min: 100 } })
    )
    // Only the 500 pnl trade should be included
    const pt10 = result.chartData.find(p => p.date === '2024-01-10')
    const pt11 = result.chartData.find(p => p.date === '2024-01-11')
    if (pt10) expect(pt10['equity_A1']).not.toBeCloseTo(10)
    if (pt11) expect(pt11['equity_A1']).toBeCloseTo(500)
  })

  it('tagFilter.tags restricts to trades with matching tag', () => {
    const trades = [
      mkTrade('A1', 100, '2024-01-10', { tags: ['breakout'] }),
      mkTrade('A1', 200, '2024-01-11', { tags: ['reversal'] }),
    ]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1')],
      [],
      defaultParams({ showIndividual: true, tagFilter: { tags: ['breakout'] } })
    )
    // Only the breakout trade should contribute
    const lastPt = [...result.chartData].pop()!
    expect(lastPt['equity_A1']).toBeCloseTo(100)
  })

  it('dateRange filter excludes trades outside range (showIndividual)', () => {
    const trades = [
      mkTrade('A1', 100, '2024-01-05'),
      mkTrade('A1', 200, '2024-01-15'),
      mkTrade('A1', 300, '2024-01-25'),
    ]
    const result = computeEquityChartData(
      trades,
      [mkAccount('A1')],
      [],
      defaultParams({
        showIndividual: true,
        dateRange: { from: '2024-01-10', to: '2024-01-20' },
      })
    )
    // Only the Jan 15 trade should be in chart
    const lastPt = [...result.chartData].pop()!
    expect(lastPt['equity_A1']).toBeCloseTo(200)
  })
})

// ─── Reset date ───────────────────────────────────────────────────────────────

describe('computeEquityChartData — reset date', () => {
  it('excludes trades before account resetDate', () => {
    const acc = mkAccount('A1', { resetDate: '2024-02-01T00:00:00Z' })
    const trades = [
      mkTrade('A1', 1_000, '2024-01-15'), // before reset
      mkTrade('A1', 500,   '2024-02-10'), // after reset
    ]
    const result = computeEquityChartData(trades, [acc], [], defaultParams({ showIndividual: true }))
    const lastPt = [...result.chartData].pop()!
    expect(lastPt['equity_A1']).toBeCloseTo(500)
  })
})

// ─── Payouts ──────────────────────────────────────────────────────────────────

describe('computeEquityChartData — payouts', () => {
  it('marks payout_account on the payout date', () => {
    const acc = mkAccount('A1', {
      payouts: [{ date: '2024-01-15T00:00:00Z', amount: 500, status: 'PAID' }],
    })
    const trades = [mkTrade('A1', 1_000, '2024-01-10')]
    const result = computeEquityChartData(
      trades,
      [acc],
      [],
      defaultParams({ showIndividual: true })
    )
    const payoutPt = result.chartData.find(p => p.date === '2024-01-15')!
    expect(payoutPt['payout_A1']).toBe(true)
  })

  it('reduces equity after payout (PAID/PENDING/VALIDATED)', () => {
    const acc = mkAccount('A1', {
      payouts: [{ date: '2024-01-16T00:00:00Z', amount: 300, status: 'PAID' }],
    })
    const trades = [mkTrade('A1', 1_000, '2024-01-10')]
    const result = computeEquityChartData(
      trades,
      [acc],
      [],
      defaultParams({ showIndividual: true })
    )
    const afterPayout = result.chartData.find(p => p.date >= '2024-01-16')!
    expect(afterPayout['equity_A1']).toBeCloseTo(700)
  })

  it('REJECTED payout does not affect equity', () => {
    const acc = mkAccount('A1', {
      payouts: [{ date: '2024-01-16T00:00:00Z', amount: 300, status: 'REJECTED' }],
    })
    const trades = [mkTrade('A1', 1_000, '2024-01-10')]
    const result = computeEquityChartData(
      trades,
      [acc],
      [],
      defaultParams({ showIndividual: true })
    )
    const after = result.chartData.find(p => p.date >= '2024-01-16')!
    expect(after['equity_A1']).toBeCloseTo(1_000)
  })
})

// ─── Hidden accounts ──────────────────────────────────────────────────────────

describe('computeEquityChartData — hidden accounts', () => {
  it('completely excludes trades from Hidden Accounts group', () => {
    const hiddenGroup = mkGroup('g1', 'Hidden Accounts', ['A_HIDDEN'])
    const visibleAcc = mkAccount('A_VISIBLE')
    const hiddenAcc  = mkAccount('A_HIDDEN', { groupId: 'g1' })
    const trades = [
      mkTrade('A_VISIBLE', 100, '2024-01-10'),
      mkTrade('A_HIDDEN',  999, '2024-01-10'),
    ]
    const result = computeEquityChartData(
      trades,
      [visibleAcc, hiddenAcc],
      [hiddenGroup],
      defaultParams()
    )
    const pt = result.chartData.find(p => p.date === '2024-01-10')!
    expect(pt.equity).toBeCloseTo(100)
  })
})
