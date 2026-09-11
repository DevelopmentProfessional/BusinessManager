import React, { useState } from "react";
import { ClockIcon, PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import useStore from "../../services/useStore";
import { attendanceAPI } from "../../services/api";

export default function Widget_Attendance({ compact = false }) {
  const { user, hasPermission } = useStore();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [todayHours, setTodayHours] = useState(null);

  // No auto-load on mount - attendance is click-based only

  const handleClockAction = async () => {
    if (!user?.id) {
      setError("You must be logged in");
      return;
    }

    if (!hasPermission("attendance", "write")) {
      setError("No permission to clock in/out");
      return;
    }

    setClockActionLoading(true);
    setError("");

    try {
      if (isClockedIn) {
        const response = await attendanceAPI.clockOut();
        setIsClockedIn(false);
        setCurrentRecord(null);
        // Update today's hours from response if available
        if (response?.data?.total_hours !== undefined) {
          setTodayHours((prev) => (prev || 0) + response.data.total_hours);
        }
      } else {
        const response = await attendanceAPI.clockIn();
        setIsClockedIn(true);
        // Set current record from response
        if (response?.data) {
          setCurrentRecord(response.data);
        } else {
          setCurrentRecord({ clock_in: new Date().toISOString() });
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || (isClockedIn ? "Failed to clock out" : "Failed to clock in");
      setError(errorMessage);
    } finally {
      setClockActionLoading(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "--:--";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return "0h 0m";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Calculate elapsed time if clocked in
  const getElapsedTime = () => {
    if (!currentRecord?.clock_in) return null;
    const start = new Date(currentRecord.clock_in);
    const now = new Date();
    const elapsed = (now - start) / (1000 * 60 * 60); // hours
    return elapsed;
  };

  if (!hasPermission("attendance", "read") && !hasPermission("attendance", "write")) {
    return null;
  }

  if (compact) {
    // Compact version for embedding in other pages
    return (
      <div className="bg-white border dark:bg-gray-800 p-1 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="ui-flex-items-gap-2">
            <ClockIcon className={`h-5 w-5 ${isClockedIn ? "text-green-500" : "text-gray-400"}`} />
            <div>
              <div className="font-medium text-sm">{isClockedIn ? "Clocked In" : "Clocked Out"}</div>
              {isClockedIn && currentRecord && <div className="text-gray-500 text-xs">Since {formatTime(currentRecord.clock_in)}</div>}
            </div>
          </div>
          <button onClick={handleClockAction} disabled={clockActionLoading} className={`px-1 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 ${isClockedIn ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"} disabled:opacity-50`}>
            {clockActionLoading ? (
              <span className="animate-spin border-2 border-current border-t-transparent h-4 rounded-full w-4" />
            ) : isClockedIn ? (
              <>
                <StopIcon className="ui-icon-4" />
                Out
              </>
            ) : (
              <>
                <PlayIcon className="ui-icon-4" />
                In
              </>
            )}
          </button>
        </div>
        {error && <div className="mt-2 text-red-500 text-xs">{error}</div>}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-white border dark:bg-gray-800 p-1 rounded-lg shadow">
      <div className="flex gap-2 items-center mb-4">
        <ClockIcon className="h-6 text-primary w-6" />
        <h3 className="font-semibold text-lg">Time Tracking</h3>
      </div>

      {error && <div className="bg-red-50 border border-red-200 mb-4 px-1 py-0 rounded text-red-700 text-sm">{error}</div>}

      <div className="gap-4 grid grid-cols-2 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-1 rounded-lg text-center">
          <div className="font-bold text-2xl text-primary">{isClockedIn ? formatHours(getElapsedTime()) : "--"}</div>
          <div className="text-gray-500 text-xs">Current Session</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-1 rounded-lg text-center">
          <div className="font-bold text-2xl text-green-600">{formatHours(todayHours)}</div>
          <div className="text-gray-500 text-xs">Today's Total</div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 flex items-center justify-between mb-4 p-1 rounded-lg">
        <div>
          <div className={`text-sm font-medium ${isClockedIn ? "text-green-600" : "text-gray-500"}`}>Status: {isClockedIn ? "Clocked In" : "Clocked Out"}</div>
          {isClockedIn && currentRecord && <div className="text-gray-500 text-xs">Since {formatTime(currentRecord.clock_in)}</div>}
        </div>
        <div className={`w-3 h-3 rounded-full ${isClockedIn ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
      </div>

      <button
        onClick={handleClockAction}
        disabled={clockActionLoading}
        className={`w-full py-0 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${isClockedIn ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"} disabled:opacity-50`}
      >
        {clockActionLoading ? (
          <>
            <span className="animate-spin border-2 border-t-transparent border-white h-5 rounded-full w-5" />
            …
          </>
        ) : isClockedIn ? (
          <>
            <StopIcon className="ui-icon-5" />
            Clock Out
          </>
        ) : (
          <>
            <PlayIcon className="ui-icon-5" />
            Clock In
          </>
        )}
      </button>
    </div>
  );
}
