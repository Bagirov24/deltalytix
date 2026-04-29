import { resolveDateRange, previousPeriod } from '../date-utils'
import type { PeriodRange } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Strip time component — we only care about calendar dates in most assertions */
const d = (date: Date) => date.toISOString().slice(0, 10)

/** Freeze Date.now() so tests don’t drift with real time */
const fakeNow = new Date('2024-06-15T12:00:00Z') // Saturday, mid-year

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(fakeNow)
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── resolveDateRange ────────────────────────────────────────────────────────

describe('resolveDateRange', () => {

  // ─ week ───────────────────────────────────────────────────────────────
  describe('type="week"', () => {
    it('offset=0 returns the current Mon–Sun week', () => {
      // 2024-06-15 is a Saturday; Mon = 2024-06-10, Sun = 2024-06-16
      const r = resolveDateRange({ type: 'week', offset: 0 })
      expect(d(r.from)).toBe('2024-06-10')
      expect(d(r.to)).toBe('2024-06-16')
    })

    it('offset=-1 returns the previous week', () => {
      const r = resolveDateRange({ type: 'week', offset: -1 })
      expect(d(r.from)).toBe('2024-06-03')
      expect(d(r.to)).toBe('2024-06-09')
    })

    it('label starts with "Week of"', () => {
      const r = resolveDateRange({ type: 'week', offset: 0 })
      expect(r.label).toMatch(/^Week of/)
    })

    it('range is exactly 6 days wide (Mon–Sun)', () => {
      const r = resolveDateRange({ type: 'week', offset: 0 })
      const diff = (r.to.getTime() - r.from.getTime()) / (1000 * 60 * 60 * 24)
      expect(diff).toBe(6)
    })
  })

  // ─ month ──────────────────────────────────────────────────────────────
  describe('type="month"', () => {
    it('offset=0 returns June 2024', () => {
      const r = resolveDateRange({ type: 'month', offset: 0 })
      expect(d(r.from)).toBe('2024-06-01')
      expect(d(r.to)).toBe('2024-06-30')
    })

    it('offset=-1 returns May 2024', () => {
      const r = resolveDateRange({ type: 'month', offset: -1 })
      expect(d(r.from)).toBe('2024-05-01')
      expect(d(r.to)).toBe('2024-05-31')
    })

    it('offset=-6 crosses year boundary to December 2023', () => {
      const r = resolveDateRange({ type: 'month', offset: -6 })
      expect(d(r.from)).toBe('2023-12-01')
      expect(d(r.to)).toBe('2023-12-31')
    })

    it('handles leap-year February correctly (2024-02)', () => {
      vi.setSystemTime(new Date('2024-02-15T12:00:00Z'))
      const r = resolveDateRange({ type: 'month', offset: 0 })
      expect(d(r.from)).toBe('2024-02-01')
      expect(d(r.to)).toBe('2024-02-29') // 2024 is a leap year
    })

    it('handles non-leap February correctly (2023-02)', () => {
      vi.setSystemTime(new Date('2023-02-10T12:00:00Z'))
      const r = resolveDateRange({ type: 'month', offset: 0 })
      expect(d(r.from)).toBe('2023-02-01')
      expect(d(r.to)).toBe('2023-02-28')
    })

    it('label contains month name and year', () => {
      const r = resolveDateRange({ type: 'month', offset: 0 })
      expect(r.label).toMatch(/June.*2024|2024.*June/)
    })
  })

  // ─ quarter ───────────────────────────────────────────────────────────
  describe('type="quarter"', () => {
    it('offset=0 returns Q2 2024 (Apr–Jun)', () => {
      // 2024-06-15 is in Q2
      const r = resolveDateRange({ type: 'quarter', offset: 0 })
      expect(d(r.from)).toBe('2024-04-01')
      expect(d(r.to)).toBe('2024-06-30')
    })

    it('offset=-1 returns Q1 2024 (Jan–Mar)', () => {
      const r = resolveDateRange({ type: 'quarter', offset: -1 })
      expect(d(r.from)).toBe('2024-01-01')
      expect(d(r.to)).toBe('2024-03-31')
    })

    it('label format is "Q{n} {year}"', () => {
      const r = resolveDateRange({ type: 'quarter', offset: 0 })
      expect(r.label).toBe('Q2 2024')
    })

    it('offset=-2 crosses to Q4 2023', () => {
      const r = resolveDateRange({ type: 'quarter', offset: -2 })
      expect(d(r.from)).toBe('2023-10-01')
      expect(d(r.to)).toBe('2023-12-31')
    })
  })

  // ─ year ────────────────────────────────────────────────────────────────
  describe('type="year"', () => {
    it('offset=0 returns full year 2024', () => {
      const r = resolveDateRange({ type: 'year', offset: 0 })
      expect(d(r.from)).toBe('2024-01-01')
      expect(d(r.to)).toBe('2024-12-31')
    })

    it('offset=-1 returns full year 2023', () => {
      const r = resolveDateRange({ type: 'year', offset: -1 })
      expect(d(r.from)).toBe('2023-01-01')
      expect(d(r.to)).toBe('2023-12-31')
    })

    it('label is the year as a string', () => {
      const r = resolveDateRange({ type: 'year', offset: 0 })
      expect(r.label).toBe('2024')
    })
  })

  // ─ custom ─────────────────────────────────────────────────────────────
  describe('type="custom"', () => {
    it('uses from/to as-is', () => {
      const r = resolveDateRange({
        type: 'custom',
        offset: 0,
        from: '2024-03-01',
        to:   '2024-03-31',
      })
      expect(d(r.from)).toBe('2024-03-01')
      expect(d(r.to)).toBe('2024-03-31')
    })

    it('label shows "from – to"', () => {
      const r = resolveDateRange({
        type: 'custom',
        offset: 0,
        from: '2024-03-01',
        to:   '2024-03-31',
      })
      expect(r.label).toContain('2024-03-01')
      expect(r.label).toContain('2024-03-31')
    })

    it('falls back to current month when from/to are missing', () => {
      // type=custom but no from/to → hits the fallback branch
      const r = resolveDateRange({ type: 'custom', offset: 0 })
      expect(d(r.from)).toBe('2024-06-01')
      expect(d(r.to)).toBe('2024-06-30')
    })
  })

  // ─ from/to contract ──────────────────────────────────────────────────
  describe('from/to contract', () => {
    it('from is always ≤ to', () => {
      const types: Array<PeriodRange['type']> = ['week', 'month', 'quarter', 'year']
      for (const type of types) {
        const r = resolveDateRange({ type, offset: 0 })
        expect(r.from.getTime()).toBeLessThanOrEqual(r.to.getTime())
      }
    })

    it('from is always ≤ to for previous periods', () => {
      const types: Array<PeriodRange['type']> = ['week', 'month', 'quarter', 'year']
      for (const type of types) {
        const r = resolveDateRange({ type, offset: -3 })
        expect(r.from.getTime()).toBeLessThanOrEqual(r.to.getTime())
      }
    })
  })
})

// ─── previousPeriod ──────────────────────────────────────────────────────────

describe('previousPeriod', () => {
  it('decrements offset by 1', () => {
    const curr: PeriodRange = { type: 'month', offset: 0 }
    const prev = previousPeriod(curr)
    expect(prev.offset).toBe(-1)
  })

  it('decrements from already-negative offset', () => {
    const curr: PeriodRange = { type: 'month', offset: -3 }
    const prev = previousPeriod(curr)
    expect(prev.offset).toBe(-4)
  })

  it('preserves type', () => {
    const prev = previousPeriod({ type: 'quarter', offset: 0 })
    expect(prev.type).toBe('quarter')
  })

  it('preserves custom from/to if present', () => {
    const curr: PeriodRange = { type: 'custom', offset: 0, from: '2024-01-01', to: '2024-01-31' }
    const prev = previousPeriod(curr)
    expect(prev.from).toBe('2024-01-01')
    expect(prev.to).toBe('2024-01-31')
    expect(prev.offset).toBe(-1)
  })

  it('does not mutate the original object', () => {
    const curr: PeriodRange = { type: 'year', offset: 0 }
    previousPeriod(curr)
    expect(curr.offset).toBe(0)
  })

  it('composing twice gives offset -2', () => {
    const curr: PeriodRange = { type: 'week', offset: 0 }
    const prev2 = previousPeriod(previousPeriod(curr))
    expect(prev2.offset).toBe(-2)
  })
})
