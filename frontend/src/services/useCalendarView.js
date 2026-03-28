// FILE: useCalendarView.js
// Custom hook that manages calendar view state, navigation, swipe gestures, and calendar utility functions for the Schedule page.

import { useState, useRef, useCallback } from "react";

const MIN_SWIPE_DISTANCE = 50;
const SWIPE_COOLDOWN = 300;

const MIN_DATE = new Date(1900, 0, 1);
const MAX_DATE = new Date(2100, 11, 31);

export default function useCalendarView({ scheduleSettings }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("week");
  const [swipeOffset, setSwipeOffset] = useState(0);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastSwipeTime = useRef(0);

  const handleNavigatePrevious = useCallback(() => {
    const newDate = new Date(currentDate);

    if (currentView === "day") {
      newDate.setDate(newDate.getDate() - 1);
    } else if (currentView === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      const currentDay = newDate.getDate();
      newDate.setMonth(newDate.getMonth() - 1);
      const maxDayInNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      if (currentDay > maxDayInNewMonth) {
        newDate.setDate(maxDayInNewMonth);
      }
    }

    if (newDate < MIN_DATE) {
      console.warn("Cannot navigate before", MIN_DATE.toLocaleDateString());
      return;
    }

    setCurrentDate(newDate);
  }, [currentDate, currentView]);

  const handleNavigateNext = useCallback(() => {
    const newDate = new Date(currentDate);

    if (currentView === "day") {
      newDate.setDate(newDate.getDate() + 1);
    } else if (currentView === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      const currentDay = newDate.getDate();
      newDate.setMonth(newDate.getMonth() + 1);
      const maxDayInNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      if (currentDay > maxDayInNewMonth) {
        newDate.setDate(maxDayInNewMonth);
      }
    }

    if (newDate > MAX_DATE) {
      console.warn("Cannot navigate beyond", MAX_DATE.toLocaleDateString());
      return;
    }

    setCurrentDate(newDate);
  }, [currentDate, currentView]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartX.current) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - touchStartX.current;

    const maxOffset = 100;
    const constrainedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX * 0.3));
    setSwipeOffset(constrainedOffset);
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (!touchStartX.current) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();

      const distanceX = touchStartX.current - touchEndX;
      const distanceY = touchStartY.current - touchEndY;
      const swipeDuration = touchEndTime - touchStartTime.current;

      setSwipeOffset(0);

      if (Math.abs(distanceY) > Math.abs(distanceX)) {
        touchStartX.current = 0;
        touchStartY.current = 0;
        return;
      }

      const timeSinceLastSwipe = touchEndTime - lastSwipeTime.current;
      if (timeSinceLastSwipe < SWIPE_COOLDOWN) {
        touchStartX.current = 0;
        touchStartY.current = 0;
        return;
      }

      if (Math.abs(distanceX) > MIN_SWIPE_DISTANCE && swipeDuration < 500) {
        if (distanceX > 0) {
          handleNavigateNext();
          lastSwipeTime.current = touchEndTime;
        } else {
          handleNavigatePrevious();
          lastSwipeTime.current = touchEndTime;
        }
      }

      touchStartX.current = 0;
      touchStartY.current = 0;
    },
    [handleNavigateNext, handleNavigatePrevious]
  );

  const isDayEnabled = useCallback(
    (date, settings) => {
      const effectiveSettings = settings ?? scheduleSettings;
      const dayOfWeek = date.getDay();
      const dayMap = [
        "sunday_enabled",
        "monday_enabled",
        "tuesday_enabled",
        "wednesday_enabled",
        "thursday_enabled",
        "friday_enabled",
        "saturday_enabled",
      ];
      return effectiveSettings[dayMap[dayOfWeek]];
    },
    [scheduleSettings]
  );

  const getCalendarDays = useCallback(
    (date, view, settings, isDayEnabledFn) => {
      const effectiveDate = date ?? currentDate;
      const effectiveView = view ?? currentView;
      const effectiveIsDayEnabled = isDayEnabledFn ?? ((d) => isDayEnabled(d, settings));

      if (effectiveView === "day") {
        return [new Date(effectiveDate)];
      } else if (effectiveView === "week") {
        const startOfWeek = new Date(effectiveDate);
        startOfWeek.setDate(effectiveDate.getDate() - effectiveDate.getDay());

        const days = [];
        for (let i = 0; i < 7; i++) {
          const day = new Date(startOfWeek);
          day.setDate(startOfWeek.getDate() + i);
          if (effectiveIsDayEnabled(day)) {
            days.push(day);
          }
        }
        return days;
      } else {
        const year = effectiveDate.getFullYear();
        const month = effectiveDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const enabledDays = [];
        for (let i = 0; i < 7; i++) {
          const testDate = new Date(2024, 0, i);
          if (effectiveIsDayEnabled(testDate)) {
            enabledDays.push(i);
          }
        }

        let startDate = new Date(firstDay);
        while (!effectiveIsDayEnabled(startDate) && startDate <= lastDay) {
          startDate.setDate(startDate.getDate() + 1);
        }

        const days = [];
        const currentDateObj = new Date(startDate);

        const firstEnabledDay = enabledDays[0];
        const startDayOfWeek = startDate.getDay();
        if (startDayOfWeek !== firstEnabledDay) {
          let daysBack = 0;
          let checkDay = startDayOfWeek;
          while (checkDay !== firstEnabledDay) {
            checkDay = (checkDay - 1 + 7) % 7;
            daysBack++;
            if (daysBack > 7) break;
          }
          currentDateObj.setDate(currentDateObj.getDate() - daysBack);
        }

        const maxDays = enabledDays.length * 6;
        const cutoffDate = new Date(year, month + 1, 7);
        while (days.length < maxDays) {
          const dayToAdd = new Date(currentDateObj);
          if (effectiveIsDayEnabled(dayToAdd)) {
            days.push(dayToAdd);
          }
          currentDateObj.setDate(currentDateObj.getDate() + 1);

          if (currentDateObj > cutoffDate) {
            break;
          }
        }

        return days;
      }
    },
    [currentDate, currentView, isDayEnabled]
  );

  const getTimeSlots = useCallback(
    (settings) => {
      const effectiveSettings = settings ?? scheduleSettings;
      const timeSlots = [];
      const startHour = parseInt(effectiveSettings.start_of_day.split(":")[0], 10) || 6;
      const endHour = parseInt(effectiveSettings.end_of_day.split(":")[0], 10) || 21;
      for (let hour = startHour; hour <= endHour; hour++) {
        timeSlots.push(hour);
      }
      return timeSlots;
    },
    [scheduleSettings]
  );

  return {
    currentDate,
    setCurrentDate,
    currentView,
    setCurrentView,
    swipeOffset,
    handleNavigatePrevious,
    handleNavigateNext,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getCalendarDays,
    getTimeSlots,
    isDayEnabled,
  };
}
