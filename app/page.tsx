'use client';

import { calculatePRFrequency, getCurrentMonth, getDateRangeFromMonth } from '@/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import ActivityCard from './components/ActivityCard';
import ControlPanel from './components/ControlPanel';
import Header from './components/Header';

interface ActivityRecord {
    date: string;
    commits: number;
    prs: number;
}

function HomeContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [activity, setActivity] = useState<ActivityRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Get initial month from URL or default to current month
    const getInitialMonth = () => {
        const monthParam = searchParams.get('month');
        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            return monthParam;
        }
        return getCurrentMonth();
    };

    const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());

    const fetchActivity = async () => {
        setLoading(true);
        try {
            const { startDate, endDate } = getDateRangeFromMonth(selectedMonth);
            const res = await fetch(`/api/activity?startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            setActivity(data.data || []);
        } catch (error) {
            console.error('Error fetching activity:', error);
        }
        setLoading(false);
    };

    // Update URL when month changes
    const handleMonthChange = (newMonth: string) => {
        setSelectedMonth(newMonth);
        // Update URL with new month parameter
        router.push(`${pathname}?month=${newMonth}`, { scroll: false });
    };

    // Initialize from URL on mount
    useEffect(() => {
        const monthFromUrl = searchParams.get('month');
        if (monthFromUrl && /^\d{4}-\d{2}$/.test(monthFromUrl)) {
            setSelectedMonth(monthFromUrl);
        } else {
            // Set URL to current month if not present
            const currentMonth = getCurrentMonth();
            router.replace(`${pathname}?month=${currentMonth}`, { scroll: false });
        }
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            fetchActivity();
        }
    }, [selectedMonth]);

    // Calculate totals
    const totalCommits = activity.reduce((sum, record) => sum + record.commits, 0);
    const totalPRs = activity.reduce((sum, record) => sum + record.prs, 0);

    // Calculate PR Frequency (PRs per active working day)
    const prFrequency = calculatePRFrequency(activity, totalPRs);

    return (
        <div className="min-h-screen bg-gray-900">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
                <div className="space-y-6">
                    <ControlPanel
                        selectedMonth={selectedMonth}
                        setSelectedMonth={handleMonthChange}
                        onRefresh={fetchActivity}
                        loading={loading}
                        totalCommits={totalCommits}
                        totalPRs={totalPRs}
                        prFrequency={prFrequency}
                    />

                    <ActivityCard activity={activity} loading={loading} />
                </div>
            </main>

            <footer className="py-8 text-center text-gray-400 text-sm">
                <p>GitHub token is valid till 31st March 2026 </p>
                <p>Built with Next.js, Tailwind CSS, GitHub API, MongoDB and Cursor</p>
            </footer>
        </div>
    );
}

export default function Home() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading...</p>
                    </div>
                </div>
            }
        >
            <HomeContent />
        </Suspense>
    );
}
