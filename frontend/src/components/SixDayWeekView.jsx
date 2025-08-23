import React from 'react';
import { Navigate } from 'react-big-calendar';
import TimeGrid from 'react-big-calendar/lib/TimeGrid';

class SixDayWeekView extends React.Component {
  render() {
    let { date } = this.props;
    let range = SixDayWeekView.range(date);

    return <TimeGrid {...this.props} range={range} eventOffset={15} />;
  }
}

SixDayWeekView.range = date => {
  let start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1); // Start on Monday

  let end = new Date(start);
  end.setDate(end.getDate() + 5); // End on Saturday

  let current = new Date(start);
  let range = [];

  while (current <= end) {
    range.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return range;
};

SixDayWeekView.navigate = (date, action) => {
  switch (action) {
    case Navigate.PREVIOUS:
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7);

    case Navigate.NEXT:
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);

    default:
      return date;
  }
};

SixDayWeekView.title = date => {
  let start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1);
  let end = new Date(start);
  end.setDate(end.getDate() + 5);

  const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long' });
  const startMonth = monthFormat.format(start);
  const endMonth = monthFormat.format(end);

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
};

export default SixDayWeekView;
