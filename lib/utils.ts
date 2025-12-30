/**
 * Get current month in YYYY-MM format
 */
export const getCurrentMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Get start and end dates for a given month
 * @param yearMonth - Month in YYYY-MM format
 * @returns Object with startDate and endDate in YYYY-MM-DD format
 */
export const getDateRangeFromMonth = (yearMonth: string): { startDate: string; endDate: string } => {
    const [year, month] = yearMonth.split('-');

    // First day of the month
    const startDate = `${year}-${month}-01`;

    // Last day of the month
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    return {
        startDate,
        endDate,
    };
};

/**
 * Check if a date string (DD-MM-YYYY) is a weekend
 * @param dateStr - Date in DD-MM-YYYY format
 * @returns true if weekend, false otherwise
 */
export const isWeekend = (dateStr: string): boolean => {
    const [day, month, year] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
};

/**
 * Calculate PR Frequency (PRs per active working day)
 * @param activity - Array of activity records
 * @param totalPRs - Total number of PRs
 * @returns PR frequency as a string with 2 decimal places
 */
export const calculatePRFrequency = (activity: Array<{ date: string; commits: number }>, totalPRs: number): string => {
    // Count active working days (has commits, not weekend)
    const activeWorkingDays = activity.filter((record) => record.commits > 0 && !isWeekend(record.date)).length;

    if (activeWorkingDays === 0) return '0.00';

    // Calculate frequency
    return (totalPRs / activeWorkingDays).toFixed(2);
};

export const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
};