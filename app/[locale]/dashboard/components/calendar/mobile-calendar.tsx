'use client'

import React, { useState } from "react"
import { format, addMonths, subMonths, addDays, getDay } from "date-fns"
import { formatInTimeZone, toDate } from 'date-fns-tz'
import { fr, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CalendarModal } from "./daily-modal"
import { CalendarData } from "@/app/[locale]/dashboard/types/calendar"
import { Card, CardTitle } from "@/components/ui/card"
import { useI18n, useCurrentLocale } from "@/locales/client"
import { useUserStore } from "../../../../../store/user-store"
import type { EconomicEvent, EventImpact } from "@/lib/economic-calendar"
import { maxImpactForDate } from "@/lib/economic-calendar"

function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (absValue >= 1000)    return `${(value / 1000).toFixed(1)}K`
  return value.toFixed(0)
}

function getCalendarDayStrings(currentMonthDate: Date, timezone: string, weekStartsOnMonday: boolean = false): string[] {
  const monthStartString = formatInTimeZone(currentMonthDate, timezone, 'yyyy-MM-01')
  const firstDayOfMonthInTZ = toDate(monthStartString, { timeZone: timezone })
  const startDayOfWeek = getDay(firstDayOfMonthInTZ)
  const daysToSubtract = weekStartsOnMonday
    ? (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1)
    : startDayOfWeek
  let currentGridDate = addDays(firstDayOfMonthInTZ, -daysToSubtract)
  const dayStrings: string[] = []
  for (let i = 0; i < 42; i++) {
    dayStrings.push(formatInTimeZone(currentGridDate, timezone, 'yyyy-MM-dd'))
    currentGridDate = addDays(currentGridDate, 1)
  }
  return dayStrings
}

function isDateStringToday(dateString: string, timezone: string): boolean {
  return dateString === formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd')
}

// Impact → colour for the mobile dot indicator
const MOBILE_IMPACT_DOT: Record<EventImpact, string> = {
  HIGH:    'bg-red-500',
  MEDIUM:  'bg-amber-400',
  LOW:     'bg-sky-400',
  UNKNOWN: 'bg-muted-foreground/30',
}

interface MobileCalendarProps {
  calendarData: CalendarData
  /** Economic events grouped by 'YYYY-MM-DD' */
  economicEventsByDate?: Record<string, EconomicEvent[]>
}

export default function MobileCalendarPnl({ calendarData, economicEventsByDate = {} }: MobileCalendarProps) {
  const t = useI18n()
  const locale = useCurrentLocale()
  const timezone = useUserStore(state => state.timezone)
  const dateLocale = locale === 'fr' ? fr : enUS
  const weekStartsOnMonday = locale === 'fr'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const calendarDayStrings = getCalendarDayStrings(currentDate, timezone, weekStartsOnMonday)

  const currentMonthReferenceDate = toDate(formatInTimeZone(currentDate, timezone, 'yyyy-MM-01'), { timeZone: timezone })
  const currentMonth = currentMonthReferenceDate.getMonth()
  const currentYear  = currentMonthReferenceDate.getFullYear()

  const weekdayHeaders = weekStartsOnMonday
    ? [
        { key: 'monday',    label: t('calendar.weekdays.mon') },
        { key: 'tuesday',   label: t('calendar.weekdays.tue') },
        { key: 'wednesday', label: t('calendar.weekdays.wed') },
        { key: 'thursday',  label: t('calendar.weekdays.thu') },
        { key: 'friday',    label: t('calendar.weekdays.fri') },
        { key: 'saturday',  label: t('calendar.weekdays.sat') },
        { key: 'sunday',    label: t('calendar.weekdays.sun') },
      ]
    : [
        { key: 'sunday',    label: t('calendar.weekdays.sun') },
        { key: 'monday',    label: t('calendar.weekdays.mon') },
        { key: 'tuesday',   label: t('calendar.weekdays.tue') },
        { key: 'wednesday', label: t('calendar.weekdays.wed') },
        { key: 'thursday',  label: t('calendar.weekdays.thu') },
        { key: 'friday',    label: t('calendar.weekdays.fri') },
        { key: 'saturday',  label: t('calendar.weekdays.sat') },
      ]

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))

  const calculateMonthlyTotal = () =>
    Object.entries(calendarData).reduce((total, [dateString, dayData]) => {
      try {
        const date = toDate(dateString + 'T00:00:00Z')
        if (date.getFullYear() === currentYear && date.getMonth() === currentMonth)
          return total + dayData.pnl
      } catch { /* skip */ }
      return total
    }, 0)

  const monthlyTotal = calculateMonthlyTotal()

  const getMaxPnl = () =>
    Math.max(0, ...Object.entries(calendarData)
      .filter(([dateString]) => {
        try {
          const date = toDate(dateString + 'T00:00:00Z')
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth
        } catch { return false }
      })
      .map(([_, data]) => Math.abs(data.pnl)))

  const maxPnl = getMaxPnl()

  return (
    <Card className="h-full flex flex-col">
      <div className="flex flex-row items-center justify-between space-y-0 border-b shrink-0 p-3 sm:p-4 h-[56px]">
        <div className="flex items-center gap-3">
          <CardTitle className="text-xl font-semibold truncate capitalize">
            {formatInTimeZone(currentDate, timezone, 'MMMM yyyy', { locale: dateLocale })}
          </CardTitle>
          <span className={cn(
            "text-sm font-semibold truncate",
            monthlyTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            ${formatCurrency(monthlyTotal)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-7 w-7 sm:h-8 sm:w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-7 w-7 sm:h-8 sm:w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-1.5 sm:p-4">
        <div className="grid grid-cols-7 gap-x-px mb-1">
          {weekdayHeaders.map((day) => (
            <div key={day.key} className="text-center font-medium text-[9px] sm:text-[11px] text-muted-foreground">
              {day.label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr gap-px h-[calc(100%-20px)]">
          {calendarDayStrings.map((dateString) => {
            const dayData = calendarData[dateString]
            let dateInTZ: Date
            try {
              dateInTZ = toDate(dateString, { timeZone: timezone })
            } catch {
              return <div key={dateString} className="text-red-500">Error</div>
            }

            const isCurrentMonthDay =
              dateInTZ.getMonth() === currentMonth &&
              dateInTZ.getFullYear() === currentYear

            const contribution = dayData && monthlyTotal !== 0
              ? Math.abs(dayData.pnl / monthlyTotal)
              : 0
            const strokeDasharray = contribution > 0
              ? `${contribution * 100} ${100 - (contribution * 100)}`
              : "0 100"

            // Economic event indicator for mobile
            const econEvents  = economicEventsByDate[dateString] ?? []
            const maxImpact   = econEvents.length ? maxImpactForDate(econEvents) : null
            const dotClass    = maxImpact ? MOBILE_IMPACT_DOT[maxImpact] : null

            return (
              <div
                key={dateString}
                className={cn(
                  "relative flex items-center justify-center",
                  !isCurrentMonthDay && "opacity-30"
                )}
                onClick={() => setSelectedDate(dateInTZ)}
              >
                {dayData && (
                  <svg className="absolute w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none"
                      className="stroke-current opacity-10" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="16" fill="none"
                      className={cn("stroke-current transition-all", dayData.pnl >= 0 ? "stroke-green-500" : "stroke-red-500")}
                      strokeWidth="2.5" strokeDasharray={strokeDasharray} strokeDashoffset="0" />
                  </svg>
                )}

                <div className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full z-10",
                  isDateStringToday(dateString, timezone) && "bg-primary text-primary-foreground",
                  dayData && dayData.pnl !== 0 && !isDateStringToday(dateString, timezone) && (
                    dayData.pnl > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )
                )}>
                  <span className="text-lg font-semibold">{format(dateInTZ, 'd')}</span>
                </div>

                {/* Economic event dot — top-right corner of the cell */}
                {dotClass && (
                  <span
                    className={cn(
                      'absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full',
                      dotClass
                    )}
                    aria-label={`Economic event: ${maxImpact} impact`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <CalendarModal
        isOpen={selectedDate !== null}
        onOpenChange={(open) => { if (!open) setSelectedDate(null) }}
        selectedDate={selectedDate}
        dayData={selectedDate ? calendarData[formatInTimeZone(selectedDate, timezone, 'yyyy-MM-dd')] : undefined}
        isLoading={isLoading}
      />
    </Card>
  )
}
