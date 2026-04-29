'use client'

import React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import MobileCalendarPnl from "./mobile-calendar"
import DesktopCalendarPnl from "./desktop-calendar"
import { useData } from "@/context/data-provider"
import { useEconomicEvents } from "@/hooks/use-economic-events"
import { EventCorrelationPanel } from "@/components/calendar/event-correlation-panel"

export default function CalendarPnl() {
  const { calendarData } = useData()
  const isMobile = useMediaQuery("(max-width: 640px)")

  // Current month — child calendars track their own currentDate internally,
  // so we initialise the hook to today's month and let it be a sensible default.
  // The panel is informational, so a month mismatch is acceptable.
  const today = new Date()
  const { byDate, correlation, isLoading: eventsLoading } = useEconomicEvents(
    today.getFullYear(),
    today.getMonth(),
    calendarData
  )

  return (
    <div className="flex flex-col gap-4">
      {isMobile ? (
        <MobileCalendarPnl calendarData={calendarData} economicEventsByDate={byDate} />
      ) : (
        <DesktopCalendarPnl calendarData={calendarData} economicEventsByDate={byDate} />
      )}

      {/* Event Correlation Panel — shown only when we have data and no loading */}
      {!eventsLoading && Object.keys(byDate).length > 0 && (
        <EventCorrelationPanel
          calendarData={calendarData}
          eventsByDate={byDate}
          currency="USD"
        />
      )}
    </div>
  )
}
