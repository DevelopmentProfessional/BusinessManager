import React from 'react';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, isSameDay as isSameDayFn, addMonths, startOfMonth, endOfMonth } from 'date-fns';

const SixDayMonthView = (props) => {
  const { date, localizer, events, onSelectEvent, onSelectSlot } = props;
  const monthStart = startOfWeek(date, { weekStartsOn: 1 });
  const monthEnd = endOfWeek(date, { weekStartsOn: 1 });
  
  // Get all days in the month view (6 days per week)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Group days into weeks of 6 days each
  const weeks = [];
  for (let i = 0; i < days.length; i += 6) {
    weeks.push(days.slice(i, i + 6));
  }

  return (
    <div className="rbc-month-view">
      {/* Header */}
      <div className="rbc-header">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>
      
      {/* Calendar body */}
      <div className="rbc-month-content">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="rbc-row">
            {week.map((day, dayIndex) => {
              const isCurrentMonth = isSameMonth(day, date);
              const isToday = isSameDay(day, new Date());
              
              // Get events for this day
              const dayEvents = events.filter(event => 
                isSameDayFn(new Date(event.start), day)
              );
              
              return (
                <div 
                  key={dayIndex} 
                  className={`rbc-day-bg ${isToday ? 'rbc-today' : ''}`}
                  style={{ 
                    opacity: isCurrentMonth ? 1 : 0.3,
                    cursor: 'pointer'
                  }}
                  onClick={() => onSelectSlot && onSelectSlot({ start: day, end: day })}
                >
                  <div className="rbc-button-link">
                    {format(day, 'd')}
                  </div>
                  
                  {/* Render events for this day */}
                  {dayEvents.map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className="rbc-event"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent && onSelectEvent(event);
                      }}
                    >
                      <div className="rbc-event-content">
                        {event.title}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// Add ALL required properties for react-big-calendar
SixDayMonthView.title = 'Month';
SixDayMonthView.navigate = (date, action) => {
  switch (action) {
    case 'PREV':
      return new Date(date.getFullYear(), date.getMonth() - 1, 1);
    case 'NEXT':
      return new Date(date.getFullYear(), date.getMonth() + 1, 1);
    default:
      return date;
  }
};

SixDayMonthView.range = (date) => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end };
};

SixDayMonthView.length = 6;

export default SixDayMonthView;
