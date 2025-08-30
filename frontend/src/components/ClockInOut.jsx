import React, { useState, useEffect } from 'react';
import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { attendanceAPI } from '../services/api';

export default function ClockInOut() {
  const { user, setError, clearError } = useStore();
  const [currentRecord, setCurrentRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    // Check if user has an open attendance record for today
    checkCurrentRecord();
  }, []);

  const checkCurrentRecord = async () => {
    if (!user?.employee?.id) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await attendanceAPI.getByEmployeeAndDate(user.employee.id, today);
      
      if (response.data && response.data.length > 0) {
        const record = response.data[0];
        if (record.clock_in && !record.clock_out) {
          setCurrentRecord(record);
          setLastAction('clocked in');
        }
      }
    } catch (error) {
      console.error('Error checking current record:', error);
    }
  };

  const handleClockIn = async () => {
    if (!user?.employee?.id) {
      setError('No employee account linked to user');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const recordData = {
        employee_id: user.employee.id,
        date: new Date(today).toISOString(),
        clock_in: new Date().toISOString(),
        notes: 'Clocked in via system'
      };

      const response = await attendanceAPI.create(recordData);
      setCurrentRecord(response.data);
      setLastAction('clocked in');
      clearError();
    } catch (error) {
      setError('Failed to clock in');
      console.error('Clock in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentRecord) {
      setError('No active clock-in record found');
      return;
    }

    setLoading(true);
    try {
      const clockOutTime = new Date().toISOString();
      const updateData = {
        clock_out: clockOutTime,
        total_hours: calculateHours(currentRecord.clock_in, clockOutTime)
      };

      const response = await attendanceAPI.update(currentRecord.id, updateData);
      setCurrentRecord(null);
      setLastAction('clocked out');
      clearError();
    } catch (error) {
      setError('Failed to clock out');
      console.error('Clock out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (clockIn, clockOut) => {
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    return (end - start) / (1000 * 60 * 60);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!user?.employee?.id) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No employee account linked to your user profile.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <ClockIcon className="h-12 w-12 text-gray-400" />
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {user.employee.first_name} {user.employee.last_name}
        </h3>
        
        <p className="text-sm text-gray-500 mb-6">
          {new Date().toLocaleDateString()}
        </p>

        {currentRecord ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">Currently Clocked In</p>
              <p className="text-green-600 text-sm">
                Since: {formatTime(currentRecord.clock_in)}
              </p>
            </div>
            
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <StopIcon className="h-5 w-5" />
              <span>Clock Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {lastAction && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">
                  Successfully {lastAction} at {formatTime(new Date())}
                </p>
              </div>
            )}
            
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <PlayIcon className="h-5 w-5" />
              <span>Clock In</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
