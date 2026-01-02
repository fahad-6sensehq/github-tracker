'use client';

import { useEffect, useState } from 'react';
import { ActivityCardProps, ActivityRecord } from '../interfaces/ActivityCard.interface';
import ActivityModal from './ActivityModal';

export default function ActivityCard({ activity, loading, router, pathname, searchParams }: ActivityCardProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Check if there's a day parameter in URL
  const dayParam = searchParams.get('day');
  const shouldShowList = !dayParam || selectedActivity !== null || !isInitialLoad;

  // Check URL for day parameter and auto-open modal
  useEffect(() => {
    if (dayParam && activity.length > 0) {
      // Find the activity record for this day
      const record = activity.find((a) => a.date === dayParam);
      if (record) {
        setSelectedActivity(record);
      }
      setIsInitialLoad(false);
    } else if (!dayParam) {
      setIsInitialLoad(false);
    }
  }, [searchParams, activity, dayParam]);

  // Handle day click - update URL and open modal
  const handleDayClick = (record: ActivityRecord) => {
    const monthParam = searchParams.get('month');
    const newUrl = monthParam ? `${pathname}?month=${monthParam}&day=${record.date}` : `${pathname}?day=${record.date}`;
    router.push(newUrl, { scroll: false });
    setSelectedActivity(record);
  };

  // Handle modal close - remove day parameter from URL
  const handleModalClose = () => {
    setSelectedActivity(null);
    setIsInitialLoad(false);
    const monthParam = searchParams.get('month');
    const newUrl = monthParam ? `${pathname}?month=${monthParam}` : pathname;
    router.push(newUrl, { scroll: false });
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 lg:p-6">
      <div>
        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-100 mb-3 sm:mb-4 flex items-center">
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Daily Activity
        </h2>

        {loading || (dayParam && !shouldShowList) ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12">
            <svg
              className="animate-spin h-8 w-8 sm:h-10 sm:w-10 text-blue-600 mb-3 sm:mb-4"
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
            <p className="text-gray-400 text-sm sm:text-base">Loading activity...</p>
          </div>
        ) : activity.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <svg
              className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-600 mb-3 sm:mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-400 text-base sm:text-lg mb-2">No activity found</p>
            <p className="text-gray-500 text-xs sm:text-sm">Sync your GitHub data to see your activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((record) => (
              <div
                key={record.date}
                onClick={() => handleDayClick(record)}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors duration-200 border border-gray-600 cursor-pointer hover:border-blue-500 gap-2 sm:gap-0"
              >
                <span className="font-mono text-xs sm:text-sm font-medium text-gray-300">📅 {record.date}</span>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <span className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-900/40 text-blue-300">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    {record.commits} commit{record.commits !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-purple-900/40 text-purple-300">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    {record.prs} PR{record.prs !== 1 ? 's' : ''}
                  </span>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal - Render outside of the conditional to avoid flash */}
        {selectedActivity && (
          <ActivityModal
            isOpen={!!selectedActivity}
            onClose={handleModalClose}
            date={selectedActivity.date}
            commits={selectedActivity.commits}
            prs={selectedActivity.prs}
            linesAdded={selectedActivity.linesAdded || 0}
            linesDeleted={selectedActivity.linesDeleted || 0}
            filesChanged={selectedActivity.filesChanged || 0}
            repositories={selectedActivity.repositories || []}
            commitDetails={selectedActivity.commitDetails || []}
            prDetails={selectedActivity.prDetails || []}
            issues={selectedActivity.issues || 0}
          />
        )}
      </div>
    </div>
  );
}
