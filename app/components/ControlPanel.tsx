'use client';

import { useEffect, useState } from 'react';
import { ControlPanelProps, MonthOption } from '../interfaces/ControlPanel.interface';

export default function ControlPanel({
  selectedMonth,
  setSelectedMonth,
  onRefresh,
  loading,
  totalCommits,
  totalPRs,
  prFrequency,
}: ControlPanelProps) {
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [loadingMonths, setLoadingMonths] = useState(true);

  useEffect(() => {
    const fetchMonths = async () => {
      try {
        const res = await fetch('/api/months');
        const data = await res.json();
        if (data.success && data.months.length > 0) {
          setAvailableMonths(data.months);
        } else {
          // Fallback to current month if no data
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const label = now.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          });
          setAvailableMonths([{ value: currentMonth, label }]);
        }
      } catch (error) {
        console.error('Error fetching months:', error);
        // Fallback to current month on error
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const label = now.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
        setAvailableMonths([{ value: currentMonth, label }]);
      } finally {
        setLoadingMonths(false);
      }
    };

    fetchMonths();
  }, []);

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Select Month */}
        <div className="bg-gradient-to-br from-gray-700/50 to-gray-700/30 rounded-lg px-4 py-3 border border-gray-600">
          <div className="text-xs font-medium text-gray-400 mb-2">Select Month</div>
          <div className="relative">
            {loadingMonths ? (
              <div className="text-base font-bold text-gray-100 flex items-center">
                <svg
                  className="animate-spin h-4 w-4 mr-2 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Loading...
              </div>
            ) : (
              <>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full appearance-none bg-transparent text-base font-bold text-gray-100 focus:outline-none cursor-pointer pr-6 [&>option]:bg-gray-800 [&>option]:text-gray-100 [&>option]:py-2 [&>option]:px-3"
                >
                  {availableMonths.map((month) => (
                    <option key={month.value} value={month.value} className="py-3">
                      {month.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Total Commits */}
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-lg px-4 py-3 border border-blue-700">
          <div className="text-xs font-medium text-blue-400 mb-2">Total Commits</div>
          <div className="text-2xl font-bold text-blue-300">{totalCommits}</div>
        </div>

        {/* Total PRs */}
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 rounded-lg px-4 py-3 border border-purple-700">
          <div className="text-xs font-medium text-purple-400 mb-2">Total PRs</div>
          <div className="text-2xl font-bold text-purple-300">{totalPRs}</div>
        </div>

        {/* PR Frequency */}
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 rounded-lg px-4 py-3 border border-green-700">
          <div className="text-xs font-medium text-green-400 mb-2">PR Frequency</div>
          <div className="text-2xl font-bold text-green-300">{prFrequency}</div>
          <div className="text-xs text-green-400/70 mt-1">PRs/active day</div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="bg-gradient-to-br from-orange-900/30 to-orange-800/30 hover:from-orange-900/40 hover:to-orange-800/40 rounded-lg px-4 py-3 border border-orange-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="text-xs font-medium text-orange-400 mb-2">Refresh</div>
          <div className="flex items-center justify-center">
            <svg
              className={`w-6 h-6 text-orange-300 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
