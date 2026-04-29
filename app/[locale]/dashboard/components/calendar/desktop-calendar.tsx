'use client'

import React, { useState, useEffect, useMemo } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, getDay, endOfWeek, addDays, isSameDay, getYear } from "date-fns"
import { formatInTimeZone } from 'date-fns-tz'
import { fr, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Newspaper, Calendar, CalendarDays } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FinancialEvent } from "@/prisma/generated/prisma/browser"
import { CalendarModal } from "./daily-modal"
import { useI18n, useCurrentLocale } from "@/locales/client"
import { translateWeekday } from "@/lib/translation-utils"
import { WeeklyModal } from "./weekly-modal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HourlyFinancialTimeline } from "../mindset/hourly-financial-timeline"
import { ImportanceFilter } from "@/app/[locale]/dashboard/components/importance-filter"
import { CountryFilter } from "@/components/country-filter"
import { useNewsFilterStore } from "@/store/filters/news-filter-store"
import { useCalendarViewStore } from "@/store/widgets/calendar-view"
import WeeklyCalendarPnl from "./weekly-calendar"
import { CalendarData } from "@/app/[locale]/dashboard/types/calendar"
import { useFinancialEventsStore } from "@/store/widgets/financial-events-store"
import { useUserStore } from "@/store/user-store"
import { Account } from "@/context/data-provider"
import { HIDDEN_GROUP_NAME } from "../filters/account-group-board"
import { EconomicEventsOverlay } from "@/components/calendar/economic-events-overlay"
import type { EconomicEvent } from "@/lib/economic-calendar"


const WEEKDAYS_SUNDAY_START = [
  'calendar.weekdays.sun',
  'calendar.weekdays.mon',
  'calendar.weekdays.tue',
  'calendar.weekdays.wed',
  'calendar.weekdays.thu',
  'calendar.weekdays.fri',
  'calendar.weekdays.sat'
] as const

const WEEKDAYS_MONDAY_START = [
  'calendar.weekdays.mon',
  'calendar.weekdays.tue',
  'calendar.weekdays.wed',
  'calendar.weekdays.thu',
  'calendar.weekdays.fri',
  'calendar.weekdays.sat',
  'calendar.weekdays.sun'
] as const


function getCalendarDays(monthStart: Date, monthEnd: Date, weekStartsOnMonday: boolean = false) {
  const weekStartsOn = weekStartsOnMonday ? 1 : 0
  const startDate = startOfWeek(monthStart, { weekStartsOn })
  const endDate = endOfWeek(monthEnd, { weekStartsOn })
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  if (days.length === 42) return days

  const lastDay = days[days.length - 1]
  const additionalDays = eachDayOfInterval({
    start: addDays(lastDay, 1),
    end: addDays(startDate, 41)
  })

  return [...days, ...additionalDays].slice(0, 42)
}

const formatCurrency = (value: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) => {
  const formatted = value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0
  })
  return formatted
}

const truncateAccountNumber = (accountNumber: string, maxLength: number = 15): string => {
  if (accountNumber.length <= maxLength) {
    return accountNumber
  }
  const lastThree = accountNumber.slice(-3)
  const remainingLength = maxLength - 3 - 1
  if (remainingLength <= 0) {
    return `...${lastThree}`
  }
  const beginning = accountNumber.slice(0, remainingLength)
  return `${beginning}...${lastThree}`
}

interface CalendarPnlProps {
  calendarData: CalendarData
  financialEvents?: FinancialEvent[]
  hideFiltersOnMobile?: boolean
  /** Economic events grouped by 'YYYY-MM-DD' — provided by calendar-widget */
  economicEventsByDate?: Record<string, EconomicEvent[]>
}


type ImpactLevel = "low" | "medium" | "high"
const IMPACT_LEVELS: ImpactLevel[] = ["low", "medium", "high"]

const getEventImportanceStars = (importance: string): ImpactLevel => {
  switch (importance.toUpperCase()) {
    case 'HIGH':   return "high"
    case 'MEDIUM': return "medium"
    case 'LOW':    return "low"
    default:       return "low"
  }
}

function EventBadge({ events, impactLevels }: { events: FinancialEvent[], impactLevels: ImpactLevel[] }) {
  const filteredEvents = events.filter(e => impactLevels.includes(getEventImportanceStars(e.importance)))
  if (filteredEvents.length === 0) return null

  const highestImportance = filteredEvents.reduce((highest, event) => {
    const level = getEventImportanceStars(event.importance)
    const levelIndex = IMPACT_LEVELS.indexOf(level)
    return Math.max(highest, levelIndex)
  }, 0)

  const badgeStyles = {
    2: "bg-background text-foreground border-border hover:bg-accent",
    1: "bg-background text-foreground border-border hover:bg-accent",
    0: "bg-background text-foreground border-border hover:bg-accent"
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "h-4 px-1.5 text-[8px] sm:text-[9px] font-medium cursor-pointer relative z-0 w-auto justify-center items-center gap-1",
            badgeStyles[highestImportance as keyof typeof badgeStyles],
            "transition-all duration-200 ease-in-out",
            "hover:scale-110 hover:shadow-md",
            "active:scale-95"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Newspaper className="h-2.5 w-2.5" />
          {filteredEvents.length}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0 z-50"
        align="start"
        side="right"
        sideOffset={5}
        onClick={(e) => e.stopPropagation()}
      >
        <HourlyFinancialTimeline
          date={filteredEvents.length > 0 ? new Date(filteredEvents[0].date) : new Date()}
          events={filteredEvents}
          className="h-[400px]"
          preventScrollPropagation={true}
        />
      </PopoverContent>
    </Popover>
  )
}

function RenewalBadge({ renewals }: { renewals: Account[] }) {
  const t = useI18n()
  if (renewals.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "h-4 px-1.5 text-[8px] sm:text-[9px] font-medium cursor-pointer relative z-0 w-auto justify-center items-center gap-1",
            "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/30",
            "transition-all duration-200 ease-in-out",
            "hover:scale-110 hover:shadow-md",
            "active:scale-95"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar className="h-2.5 w-2.5" />
          {renewals.length}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] sm:w-[380px] md:w-[420px] max-w-[90vw] p-0 z-50 border shadow-lg bg-card"
        align="start"
        side="right"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{t('propFirm.renewal.title')}</h3>
              <p className="text-xs text-muted-foreground">{renewals.length} {renewals.length === 1 ? t('propFirm.renewal.account') : t('propFirm.renewal.accounts')}</p>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {renewals.map((account) => (
              <div
                key={account.id}
                className="group relative p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-border transition-all duration-200 hover:shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                      {account.propfirm ? (
                        <>
                          <div className="font-semibold text-sm text-foreground truncate">{account.propfirm}</div>
                          <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-block w-fit">
                            <span className="block" title={account.number}>{truncateAccountNumber(account.number, 12)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="font-semibold text-sm text-foreground">
                          <span className="block" title={account.number}>{truncateAccountNumber(account.number, 18)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                      <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md font-medium whitespace-nowrap">
                        {account.paymentFrequency?.toLowerCase()} {t('propFirm.renewal.frequency')}
                      </div>
                      {account.autoRenewal && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md whitespace-nowrap">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></div>
                          <span className="text-xs font-medium">{t('propFirm.renewal.notification')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="font-bold text-base sm:text-lg text-blue-600 dark:text-blue-400 mb-1">
                      {account.price != null && formatCurrency(account.price, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground">{account.paymentFrequency?.toLowerCase()}</div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-3 right-3 sm:left-4 sm:right-4 h-0.5 bg-linear-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </div>
            ))}
          </div>
          {renewals.length > 0 && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-xs text-muted-foreground">
                <span>{t('propFirm.renewal.totalAccounts')}: {renewals.length}</span>
                <span className="truncate">
                  {t('propFirm.renewal.nextRenewal')}: {renewals[0]?.nextPaymentDate ? format(new Date(renewals[0].nextPaymentDate), 'MMM dd, yyyy') : 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function CalendarPnl({ calendarData, hideFiltersOnMobile = false, economicEventsByDate = {} }: CalendarPnlProps) {
  const accounts = useUserStore(state => state.accounts)
  const groups = useUserStore(state => state.groups)
  const t = useI18n()
  const locale = useCurrentLocale()
  const timezone = useUserStore(state => state.timezone)
  const userFinancialEvents = useFinancialEventsStore(state => state.events)
  const dateLocale = locale === 'fr' ? fr : enUS
  const weekStartsOnMonday = locale === 'fr'
  const WEEKDAYS = weekStartsOnMonday ? WEEKDAYS_MONDAY_START : WEEKDAYS_SUNDAY_START
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const [monthEvents, setMonthEvents] = useState<FinancialEvent[]>([])
  const [calendarDays, setCalendarDays] = useState<Date[]>([])

  const { monthStart, monthEnd } = React.useMemo(() => ({
    monthStart: startOfMonth(currentDate),
    monthEnd: endOfMonth(currentDate)
  }), [currentDate])

  useEffect(() => {
    setCalendarDays(getCalendarDays(monthStart, monthEnd, weekStartsOnMonday))
  }, [currentDate, monthStart, monthEnd, weekStartsOnMonday])

  const { viewMode, setViewMode, selectedDate, setSelectedDate, selectedWeekDate, setSelectedWeekDate } = useCalendarViewStore()
  const impactLevels = useNewsFilterStore((s) => s.impactLevels)
  const setImpactLevels = useNewsFilterStore((s) => s.setImpactLevels)
  const selectedCountries = useNewsFilterStore((s) => s.selectedCountries)
  const setSelectedCountries = useNewsFilterStore((s) => s.setSelectedCountries)

  useEffect(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const filteredEvents = userFinancialEvents.filter(event => {
      const eventDate = new Date(event.date)
      return eventDate >= monthStart && eventDate <= monthEnd && event.lang === locale
    })
    setMonthEvents(filteredEvents)
  }, [currentDate, userFinancialEvents, locale])

  const handlePrevMonth = React.useCallback(() => setCurrentDate(subMonths(currentDate, 1)), [currentDate])
  const handleNextMonth = React.useCallback(() => setCurrentDate(addMonths(currentDate, 1)), [currentDate])

  const countries = useMemo(() => {
    return Array.from(new Set(monthEvents
      .map(event => event.country)
      .filter((country): country is string => country !== null && country !== undefined)
    )).sort((a, b) => {
      if (a === "United States") return -1
      if (b === "United States") return 1
      return a.localeCompare(b)
    })
  }, [monthEvents])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, FinancialEvent[]>()
    monthEvents.forEach(event => {
      if (!event.date) return
      try {
        const eventDateObj = new Date(event.date)
        eventDateObj.setHours(0, 0, 0, 0)
        const dateKey = formatInTimeZone(eventDateObj, timezone, 'yyyy-MM-dd')
        if (!map.has(dateKey)) map.set(dateKey, [])
        map.get(dateKey)!.push(event)
      } catch (error) {
        console.error('Error parsing event date:', error)
      }
    })
    return map
  }, [monthEvents, timezone])

  const renewalsByDate = useMemo(() => {
    const hiddenGroup = groups.find(g => g.name === HIDDEN_GROUP_NAME)
    const hiddenAccountIds = hiddenGroup ? new Set(hiddenGroup.accounts.map(a => a.id)) : new Set()
    const map = new Map<string, Account[]>()
    accounts.forEach(account => {
      if (hiddenAccountIds.has(account.id) || !account.nextPaymentDate) return
      try {
        const renewalDateObj = new Date(account.nextPaymentDate)
        renewalDateObj.setHours(0, 0, 0, 0)
        const dateKey = formatInTimeZone(renewalDateObj, timezone, 'yyyy-MM-dd')
        if (!map.has(dateKey)) map.set(dateKey, [])
        map.get(dateKey)!.push(account)
      } catch (error) {
        console.error('Error parsing renewal date:', error)
      }
    })
    return map
  }, [accounts, timezone, groups])

  const dayCalculations = useMemo(() => {
    const calculations = new Map<string, { maxProfit: number; maxDrawdown: number }>()
    Object.entries(calendarData).forEach(([dateString, dayData]) => {
      if (!dayData.trades || dayData.trades.length === 0) {
        calculations.set(dateString, { maxProfit: 0, maxDrawdown: 0 })
        return
      }
      const sortedTrades = [...dayData.trades].sort((a, b) =>
        new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
      )
      const equity = [0]
      let cumulative = 0
      sortedTrades.forEach(trade => {
        cumulative += trade.pnl - (trade.commission || 0)
        equity.push(cumulative)
      })
      let peak = -Infinity, maxDD = 0
      equity.forEach(val => {
        if (val > peak) peak = val
        const dd = peak - val
        if (dd > maxDD) maxDD = dd
      })
      let trough = Infinity, maxRU = 0
      equity.forEach(val => {
        if (val < trough) trough = val
        const ru = val - trough
        if (ru > maxRU) maxRU = ru
      })
      calculations.set(dateString, { maxProfit: maxRU, maxDrawdown: maxDD })
    })
    return calculations
  }, [calendarData])

  const filteredEventsByDate = useMemo(() => {
    const filtered = new Map<string, FinancialEvent[]>()
    eventsByDate.forEach((events, dateKey) => {
      const filteredEvents = events.filter(e => {
        const matchesImpact = impactLevels.length === 0 || impactLevels.includes(getEventImportanceStars(e.importance))
        const matchesCountry = selectedCountries.length === 0 || (e.country && selectedCountries.includes(e.country))
        return matchesImpact && matchesCountry
      })
      if (filteredEvents.length > 0) filtered.set(dateKey, filteredEvents)
    })
    return filtered
  }, [eventsByDate, impactLevels, selectedCountries])

  const monthlyTotal = useMemo(() => {
    return Object.entries(calendarData).reduce((total, [dateString, dayData]) => {
      const date = new Date(dateString)
      return isSameMonth(date, currentDate) ? total + dayData.pnl : total
    }, 0)
  }, [calendarData, currentDate])

  const yearTotal = useMemo(() => {
    return Object.entries(calendarData).reduce((total, [dateString, dayData]) => {
      const date = new Date(dateString)
      return getYear(date) === getYear(currentDate) ? total + dayData.pnl : total
    }, 0)
  }, [calendarData, currentDate])

  const calculateWeeklyTotal = React.useCallback((index: number, calendarDays: Date[], calendarData: CalendarData) => {
    const startOfWeekIndex = index - 6
    const weekDays = calendarDays.slice(startOfWeekIndex, index + 1)
    return weekDays.reduce((total, day) => {
      const dayData = calendarData[formatInTimeZone(day, timezone, 'yyyy-MM-dd')]
      return total + (dayData ? dayData.pnl : 0)
    }, 0)
  }, [timezone])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b shrink-0 p-3 sm:p-4 h-[56px]">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base sm:text-lg font-semibold truncate capitalize">
            {viewMode === 'daily'
              ? formatInTimeZone(currentDate, timezone, 'MMMM yyyy', { locale: dateLocale })
              : formatInTimeZone(currentDate, timezone, 'yyyy', { locale: dateLocale })}
          </CardTitle>
          <div className={cn(
            "text-sm sm:text-base font-semibold truncate",
            (viewMode === 'daily' ? monthlyTotal : yearTotal) >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}>
            {formatCurrency(viewMode === 'daily' ? monthlyTotal : yearTotal)}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={cn("flex items-center gap-2", hideFiltersOnMobile && "max-sm:hidden")}>
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {t('calendar.importanceFilter.title')}
            </span>
            <ImportanceFilter value={impactLevels} onValueChange={setImpactLevels} className="h-8" />
          </div>
          <CountryFilter
            countries={countries}
            value={selectedCountries}
            onValueChange={setSelectedCountries}
            className={cn("h-8", hideFiltersOnMobile && "max-sm:hidden")}
          />
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline" size="icon"
              onClick={() => viewMode === 'daily' ? handlePrevMonth() : setCurrentDate(new Date(getYear(currentDate) - 1, 0, 1))}
              className="h-7 w-7 sm:h-8 sm:w-8"
              aria-label={viewMode === 'daily' ? "Previous month" : "Previous year"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="icon"
              onClick={() => viewMode === 'daily' ? handleNextMonth() : setCurrentDate(new Date(getYear(currentDate) + 1, 0, 1))}
              className="h-7 w-7 sm:h-8 sm:w-8"
              aria-label={viewMode === 'daily' ? "Next month" : "Next year"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-1.5 sm:p-4">
        {viewMode === 'daily' ? (
          <>
            <div className="grid grid-cols-8 gap-x-px mb-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-center font-medium text-[9px] sm:text-[11px] text-muted-foreground">
                  {translateWeekday(t, day)}
                </div>
              ))}
              <div className="text-center font-medium text-[9px] sm:text-[11px] text-muted-foreground">
                {t('calendar.weekdays.weekly')}
              </div>
            </div>
            <div className="grid grid-cols-8 auto-rows-fr rounded-lg h-[calc(100%-20px)]">
              {calendarDays.map((date, index) => {
                const dateString = format(date, 'yyyy-MM-dd')
                const dayData = calendarData[dateString]
                const isLastDayOfWeek = weekStartsOnMonday ? getDay(date) === 0 : getDay(date) === 6
                const isCurrentMonth = isSameMonth(date, currentDate)
                const dateEvents = filteredEventsByDate.get(dateString) || []
                const dateRenewals = renewalsByDate.get(dateString) || []
                const calculations = dayCalculations.get(dateString) || { maxProfit: 0, maxDrawdown: 0 }
                const maxProfit = calculations.maxProfit
                const maxDrawdown = calculations.maxDrawdown
                // Economic events for this cell
                const econEvents = economicEventsByDate[dateString] ?? []

                return (
                  <React.Fragment key={dateString}>
                    <div
                      className={cn(
                        "h-full flex flex-col cursor-pointer transition-all rounded-none p-1",
                        "ring-1 ring-border hover:ring-primary hover:z-10",
                        dayData && dayData.pnl >= 0
                          ? "bg-green-50 dark:bg-green-900/20"
                          : dayData && dayData.pnl < 0
                            ? "bg-red-50 dark:bg-red-900/20"
                            : "bg-card",
                        isToday(date) && "ring-blue-500 bg-blue-500/5 z-10",
                        index === 0 && "rounded-tl-lg",
                        index === 35 && "rounded-bl-lg",
                      )}
                      onClick={() => setSelectedDate(date)}
                    >
                      {/* Top row: date number + news/renewal badges */}
                      <div className="flex justify-between items-start gap-0.5">
                        <span className={cn(
                          "text-[9px] sm:text-[11px] font-medium min-w-[14px] text-center",
                          isToday(date) && "text-primary font-semibold",
                          !isCurrentMonth && "opacity-50"
                        )}>
                          {format(date, 'd')}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          {dateEvents.length > 0 && <EventBadge events={dateEvents} impactLevels={impactLevels} />}
                          {dateRenewals.length > 0 && <RenewalBadge renewals={dateRenewals} />}
                        </div>
                      </div>

                      {/* Economic event impact pins — below badges, above P&L */}
                      {econEvents.length > 0 && (
                        <EconomicEventsOverlay
                          events={econEvents}
                          className="mt-0.5 px-0.5"
                        />
                      )}

                      {/* P&L + trade stats */}
                      <div className="flex-1 flex flex-col justify-end gap-0.5">
                        {dayData ? (
                          <div className={cn(
                            "text-[9px] sm:text-[11px] font-semibold truncate text-center",
                            dayData.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                            !isCurrentMonth && "opacity-50"
                          )}>
                            {formatCurrency(dayData.pnl)}
                          </div>
                        ) : (
                          <div className={cn("text-[9px] sm:text-[11px] font-semibold invisible text-center", !isCurrentMonth && "opacity-50")}>$0</div>
                        )}
                        <div className={cn("text-[7px] sm:text-[9px] text-muted-foreground truncate text-center", !isCurrentMonth && "opacity-50")}>
                          {dayData
                            ? `${dayData.tradeNumber} ${dayData.tradeNumber > 1 ? t('calendar.trades') : t('calendar.trade')}`
                            : t('calendar.noTrades')}
                        </div>
                        {dayData && (
                          <>
                            <div className={cn("text-[7px] sm:text-[9px] text-green-600 dark:text-green-400 truncate text-center", !isCurrentMonth && "opacity-50")}>
                              {t('calendar.maxProfit')}: {formatCurrency(maxProfit)}
                            </div>
                            <div className={cn("text-[7px] sm:text-[9px] text-red-600 dark:text-red-400 truncate text-center", !isCurrentMonth && "opacity-50")}>
                              {t('calendar.maxDD')}: -{formatCurrency(maxDrawdown)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {isLastDayOfWeek && (() => {
                      const weeklyTotal = calculateWeeklyTotal(index, calendarDays, calendarData)
                      return (
                        <div
                          className={cn(
                            "h-full flex items-center justify-center rounded-none cursor-pointer",
                            "ring-1 ring-border hover:ring-primary hover:z-10",
                            index === 6 && "rounded-tr-lg",
                            index === 41 && "rounded-br-lg"
                          )}
                          onClick={() => setSelectedWeekDate(date)}
                        >
                          <div className={cn(
                            "text-[9px] sm:text-[11px] font-semibold truncate px-0.5",
                            weeklyTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {formatCurrency(weeklyTotal)}
                          </div>
                        </div>
                      )
                    })()}
                  </React.Fragment>
                )
              })}
            </div>
          </>
        ) : (
          <WeeklyCalendarPnl calendarData={calendarData} year={getYear(currentDate)} />
        )}
      </CardContent>

      <CalendarModal
        isOpen={selectedDate !== null && selectedDate !== undefined}
        onOpenChange={(open) => { if (!open) setSelectedDate(null) }}
        selectedDate={selectedDate}
        dayData={selectedDate ? calendarData[format(selectedDate, 'yyyy-MM-dd', { locale: dateLocale })] : undefined}
        isLoading={isLoading}
      />
      <WeeklyModal
        isOpen={selectedWeekDate !== null}
        onOpenChange={(open) => { if (!open) setSelectedWeekDate(null) }}
        selectedDate={selectedWeekDate}
        calendarData={calendarData}
        isLoading={isLoading}
      />

      <CardFooter className="flex justify-end">
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted">
          <Button
            variant={viewMode === 'daily' ? 'default' : 'ghost'}
            size="sm"
            className={cn("h-7 px-2 transition-colors", viewMode === 'daily' && "bg-primary text-primary-foreground shadow-sm font-semibold")}
            onClick={() => setViewMode('daily')}
          >
            <Calendar className="h-4 w-4 mr-1" />
            <span className="text-xs">{t('calendar.viewMode.daily')}</span>
          </Button>
          <Button
            variant={viewMode === 'weekly' ? 'default' : 'ghost'}
            size="sm"
            className={cn("h-7 px-2 transition-colors", viewMode === 'weekly' && "bg-primary text-primary-foreground shadow-sm font-semibold")}
            onClick={() => setViewMode('weekly')}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            <span className="text-xs">{t('calendar.viewMode.weekly')}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
