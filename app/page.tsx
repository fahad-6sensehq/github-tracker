"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ActivityCard from "./components/ActivityCard";
import ControlPanel from "./components/ControlPanel";
import Header from "./components/Header";

interface ActivityRecord {
  date: string;
  commits: number;
  prs: number;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize with current month (YYYY-MM format)
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  };

  // Get initial month from URL or default to current month
  const getInitialMonth = () => {
    const monthParam = searchParams.get("month");
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      return monthParam;
    }
    return getCurrentMonth();
  };

  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());

  // Get start and end dates for selected month
  const getDateRangeFromMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-");

    // First day of the month
    const startDate = `${year}-${month}-01`;

    // Last day of the month
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    return {
      startDate,
      endDate,
    };
  };

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRangeFromMonth(selectedMonth);
      const res = await fetch(
        `/api/activity?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await res.json();
      setActivity(data.data || []);
    } catch (error) {
      console.error("Error fetching activity:", error);
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
    const monthFromUrl = searchParams.get("month");
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
  const totalCommits = activity.reduce(
    (sum, record) => sum + record.commits,
    0
  );
  const totalPRs = activity.reduce((sum, record) => sum + record.prs, 0);

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
