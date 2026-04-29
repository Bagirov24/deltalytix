import { computeWinRateData, computeDrawdown, computePeriodStats, type RawTrade } from '../calculations'

// ─── Factory ──────────────────────────────────────────────────────────────────

const mk = (id: string, pnl: number, opts: Partial<RawTrade> = {}): RawTrade => ({
  id,
  instrument:     opts.instrument     ?? 'NQ',
  entryDate:      opts.entryDate      ?? '2024-01-15T09:30:00Z',
  closeDate:      opts.closeDate      ?? '2024-01-15T10:00:00Z',
  pnl,
  commission:     opts.commission     ?? 0,
  side:           opts.side           ?? 'LONG',
  timeInPosition: opts.timeInPosition ?? 30,
})

// Base dataset: 3 wins (100, 200, 80) + 2 losses (-50, -30), all zero commission
const TRADES: RawTrade[] = [
  mk('1', 100),
  mk('2', -50),
  mk('3', 200),
  mk('4', -30),
  mk('5', 80, { instrument: 'ES' }),
]

// ─── computeWinRateData ───────────────────────────────────────────────────────

describe('computeWinRateData', () => {
  describe('overall', () => {
    it('counts trades, wins and computes win rate', () => {
      const r = computeWinRateData(TRADES)
      expect(r.overall.trades).toBe(5)
      expect(r.overall.wins).toBe(3)
      expect(r.overall.losses).toBe(2)
      expect(r.overall.winRate).toBeCloseTo(0.6)
    })

    it('returns zeroed overall for empty input', () => {
      const r = computeWinRateData([])
      expect(r.overall.trades).toBe(0)
      expect(r.overall.winRate).toBe(0)
      expect(r.byInstrument).toHaveLength(0)
      expect(r.byHour).toHaveLength(0)
      expect(r.byWeekday).toHaveLength(7) // always 7 days, even if empty
    })

    it('computes totalPnl and avgPnl on overall', () => {
      const r = computeWinRateData(TRADES)
      const expectedNet = 100 - 50 + 200 - 30 + 80 // = 300
      expect(r.overall.totalPnl).toBeCloseTo(expectedNet)
      expect(r.overall.avgPnl).toBeCloseTo(expectedNet / 5)
    })
  })

  describe('commission deduction', () => {
    it('subtracts commission from pnl when determining wins/losses', () => {
      // pnl=10, commission=15 → net=-5 → should count as a LOSS
      const trades = [mk('a', 10, { commission: 15 })]
      const r = computeWinRateData(trades)
      expect(r.overall.wins).toBe(0)
      expect(r.overall.losses).toBe(1)
      expect(r.overall.totalPnl).toBeCloseTo(-5)
    })

    it('counts net-positive trade (pnl > commission) as win', () => {
      const trades = [mk('a', 50, { commission: 10 })]
      const r = computeWinRateData(trades)
      expect(r.overall.wins).toBe(1)
      expect(r.overall.totalPnl).toBeCloseTo(40)
    })

    it('handles zero-commission trades identically to previous behaviour', () => {
      const r = computeWinRateData(TRADES)
      expect(r.overall.wins).toBe(3)
    })
  })

  describe('byInstrument', () => {
    it('splits correctly by instrument', () => {
      const r = computeWinRateData(TRADES)
      const nq = r.byInstrument.find(x => x.label === 'NQ')!
      const es = r.byInstrument.find(x => x.label === 'ES')!
      expect(nq.trades).toBe(4)
      expect(es.trades).toBe(1)
      expect(es.winRate).toBe(1)
    })

    it('sorts instruments by trade count descending', () => {
      const r = computeWinRateData(TRADES)
      expect(r.byInstrument[0].label).toBe('NQ')
    })

    it('handles single-instrument dataset', () => {
      const single = [mk('a', 100), mk('b', -20)]
      const r = computeWinRateData(single)
      expect(r.byInstrument).toHaveLength(1)
      expect(r.byInstrument[0].label).toBe('NQ')
    })
  })

  describe('byWeekday (timezone-aware)', () => {
    it('always returns exactly 7 weekday buckets', () => {
      const r = computeWinRateData(TRADES)
      expect(r.byWeekday).toHaveLength(7)
    })

    it('places Monday entry (UTC) in Monday bucket', () => {
      // 2024-01-15 is a Monday
      const trades = [mk('a', 100, { entryDate: '2024-01-15T09:30:00Z' })]
      const r = computeWinRateData(trades, 'UTC')
      expect(r.byWeekday[0].label).toBe('Monday')
      expect(r.byWeekday[0].trades).toBe(1)
    })

    it('shifts weekday when timezone crosses midnight', () => {
      // 2024-01-15T23:00:00Z = Monday 23:00 UTC = Tuesday 00:00 in UTC+1 (Europe/Paris)
      const trades = [mk('a', 100, { entryDate: '2024-01-15T23:00:00Z' })]
      const utcResult  = computeWinRateData(trades, 'UTC')
      const parisResult = computeWinRateData(trades, 'Europe/Paris')
      // In UTC → Monday (index 0); in Paris → Tuesday (index 1)
      expect(utcResult.byWeekday[0].trades).toBe(1)   // Monday in UTC
      expect(parisResult.byWeekday[1].trades).toBe(1)  // Tuesday in Paris
    })

    it('defaults to UTC when no timezone provided (backward-compat)', () => {
      const trades = [mk('a', 100, { entryDate: '2024-01-15T09:30:00Z' })]
      const r = computeWinRateData(trades) // no tz arg
      expect(r.byWeekday[0].trades).toBe(1) // still Monday
    })
  })

  describe('byHour (timezone-aware)', () => {
    it('assigns correct UTC hour bucket', () => {
      const trades = [mk('a', 100, { entryDate: '2024-01-15T14:30:00Z' })]
      const r = computeWinRateData(trades, 'UTC')
      const bucket = r.byHour.find(h => h.label === '14:00')!
      expect(bucket).toBeDefined()
      expect(bucket.trades).toBe(1)
    })

    it('shifts hour when timezone offset applied', () => {
      // 14:00 UTC = 17:00 Moscow (UTC+3)
      const trades = [mk('a', 100, { entryDate: '2024-01-15T14:00:00Z' })]
      const moscow = computeWinRateData(trades, 'Europe/Moscow')
      const bucket = moscow.byHour.find(h => h.label === '17:00')!
      expect(bucket).toBeDefined()
      expect(bucket.trades).toBe(1)
    })

    it('labels hours with zero-padded HH:00 format', () => {
      const trades = [mk('a', 100, { entryDate: '2024-01-15T09:30:00Z' })]
      const r = computeWinRateData(trades, 'UTC')
      expect(r.byHour.every(h => /^\d{2}:00$/.test(h.label))).toBe(true)
    })

    it('groups multiple trades in the same hour', () => {
      const trades = [
        mk('a', 100, { entryDate: '2024-01-15T09:00:00Z' }),
        mk('b', -50, { entryDate: '2024-01-15T09:45:00Z' }),
      ]
      const r = computeWinRateData(trades, 'UTC')
      const bucket = r.byHour.find(h => h.label === '09:00')!
      expect(bucket.trades).toBe(2)
    })
  })

  describe('bySide', () => {
    it('splits LONG and SHORT correctly', () => {
      const trades = [
        mk('a',  100, { side: 'LONG' }),
        mk('b',  200, { side: 'LONG' }),
        mk('c', -50,  { side: 'SHORT' }),
      ]
      const r = computeWinRateData(trades)
      const long  = r.bySide.find(s => s.label === 'LONG')!
      const short = r.bySide.find(s => s.label === 'SHORT')!
      expect(long.trades).toBe(2)
      expect(long.winRate).toBe(1)
      expect(short.trades).toBe(1)
      expect(short.winRate).toBe(0)
    })

    it('uses "Unknown" for missing side', () => {
      const trades = [mk('a', 100, { side: '' })]
      const r = computeWinRateData(trades)
      expect(r.bySide.find(s => s.label === 'Unknown')).toBeDefined()
    })
  })
})

// ─── computeDrawdown ──────────────────────────────────────────────────────────

describe('computeDrawdown', () => {
  it('returns zeros for empty input', () => {
    const dd = computeDrawdown([])
    expect(dd.maxDrawdown).toBe(0)
    expect(dd.maxDrawdownPct).toBe(0)
    expect(dd.longestDrawdownDays).toBe(0)
    expect(dd.currentDrawdown).toBe(0)
    expect(dd.peakEquity).toBe(0)
    expect(dd.recoveryFactor).toBe(0)
    expect(dd.points).toHaveLength(0)
  })

  it('computes max drawdown on simple peak→trough sequence', () => {
    const trades = [
      mk('a', 100,  { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', -150, { closeDate: '2024-01-02T00:00:00Z' }),
      mk('c', 50,   { closeDate: '2024-01-03T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.maxDrawdown).toBe(-150)
    expect(dd.peakEquity).toBe(100)
  })

  it('maxDrawdown is 0 when equity is monotonically increasing', () => {
    const trades = [
      mk('a', 50,  { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', 100, { closeDate: '2024-01-02T00:00:00Z' }),
      mk('c', 200, { closeDate: '2024-01-03T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.maxDrawdown).toBe(0)
  })

  it('accounts for commission in drawdown calculation', () => {
    // net = 100 - 20 = 80 (win), net = -50 - 20 = -70 (loss)
    const trades = [
      mk('a', 100, { closeDate: '2024-01-01T00:00:00Z', commission: 20 }),
      mk('b', -50, { closeDate: '2024-01-02T00:00:00Z', commission: 20 }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.maxDrawdown).toBe(-70)
    expect(dd.peakEquity).toBe(80)
  })

  it('returns positive recoveryFactor when profitable with drawdown', () => {
    const trades = [
      mk('a', 200, { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', -50, { closeDate: '2024-01-02T00:00:00Z' }),
      mk('c', 100, { closeDate: '2024-01-03T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.recoveryFactor).toBeGreaterThan(0)
  })

  it('recoveryFactor is 0 when no drawdown occurred', () => {
    const trades = [
      mk('a', 100, { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', 200, { closeDate: '2024-01-02T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.recoveryFactor).toBe(0)
  })

  it('produces one point per trade', () => {
    const trades = [
      mk('a', 10, { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', -5, { closeDate: '2024-01-02T00:00:00Z' }),
      mk('c', 20, { closeDate: '2024-01-03T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.points).toHaveLength(3)
  })

  it('sorts trades by closeDate before computing', () => {
    // Deliberately reversed order
    const trades = [
      mk('c', 50,   { closeDate: '2024-01-03T00:00:00Z' }),
      mk('a', 100,  { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', -150, { closeDate: '2024-01-02T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.maxDrawdown).toBe(-150)
  })

  it('currentDrawdown is 0 when ending at new equity high', () => {
    const trades = [
      mk('a', 100, { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', -50, { closeDate: '2024-01-02T00:00:00Z' }),
      mk('c', 200, { closeDate: '2024-01-03T00:00:00Z' }),
    ]
    const dd = computeDrawdown(trades)
    expect(dd.currentDrawdown).toBe(0)
  })
})

// ─── computePeriodStats ───────────────────────────────────────────────────────

describe('computePeriodStats', () => {
  it('returns zeroed stats for empty input', () => {
    const s = computePeriodStats('Empty', [])
    expect(s.label).toBe('Empty')
    expect(s.trades).toBe(0)
    expect(s.totalPnl).toBe(0)
    expect(s.winRate).toBe(0)
    expect(s.profitFactor).toBe(0)
    expect(s.avgRR).toBe(0)
  })

  it('preserves label', () => {
    const s = computePeriodStats('April 2026', TRADES)
    expect(s.label).toBe('April 2026')
  })

  it('computes totalPnl and avgPnl', () => {
    const s = computePeriodStats('Test', TRADES)
    const expectedNet = 100 - 50 + 200 - 30 + 80 // = 300
    expect(s.totalPnl).toBeCloseTo(expectedNet)
    expect(s.avgPnl).toBeCloseTo(expectedNet / 5)
  })

  it('computes correct profit factor', () => {
    // Gross win = 380, Gross loss = 80
    const s = computePeriodStats('Test', TRADES)
    expect(s.profitFactor).toBeCloseTo(380 / 80)
  })

  it('profitFactor is Infinity when no losses', () => {
    const allWins = [mk('a', 100), mk('b', 200)]
    const s = computePeriodStats('Test', allWins)
    expect(s.profitFactor).toBe(Infinity)
  })

  it('profitFactor is 0 when no wins and no losses', () => {
    // Only break-even trades (net = 0)
    const breakEven = [mk('a', 0)]
    const s = computePeriodStats('Test', breakEven)
    expect(s.profitFactor).toBe(0)
  })

  it('winRate is 1 for all-winning trades', () => {
    const s = computePeriodStats('Test', [mk('a', 100), mk('b', 200)])
    expect(s.winRate).toBe(1)
  })

  it('winRate is 0 for all-losing trades', () => {
    const s = computePeriodStats('Test', [mk('a', -100), mk('b', -50)])
    expect(s.winRate).toBe(0)
  })

  it('identifies bestTrade and worstTrade correctly', () => {
    const s = computePeriodStats('Test', TRADES)
    expect(s.bestTrade).toBe(200)
    expect(s.worstTrade).toBe(-50)
  })

  it('deducts commission before computing stats', () => {
    // pnl=100, commission=120 → net=-20 → should be a loss
    const trades = [mk('a', 100, { commission: 120 })]
    const s = computePeriodStats('Test', trades)
    expect(s.winRate).toBe(0)
    expect(s.totalPnl).toBeCloseTo(-20)
    expect(s.bestTrade).toBeCloseTo(-20)
    expect(s.worstTrade).toBeCloseTo(-20)
  })

  it('computes avgRR > 0 when avg win > avg loss', () => {
    const trades = [
      mk('a',  200), // big win
      mk('b', -50),  // small loss
    ]
    const s = computePeriodStats('Test', trades)
    expect(s.avgRR).toBeGreaterThan(1)
  })

  it('includes max drawdown from the period', () => {
    const trades = [
      mk('a', 100,  { closeDate: '2024-01-01T00:00:00Z' }),
      mk('b', -200, { closeDate: '2024-01-02T00:00:00Z' }),
      mk('c', 50,   { closeDate: '2024-01-03T00:00:00Z' }),
    ]
    const s = computePeriodStats('Test', trades)
    expect(s.maxDrawdown).toBe(-200)
  })
})
