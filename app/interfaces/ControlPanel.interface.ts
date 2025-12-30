export interface ControlPanelProps {
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
    onRefresh: () => void;
    loading: boolean;
    totalCommits: number;
    totalPRs: number;
    prFrequency: string;
}

export interface MonthOption {
    value: string;
    label: string;
}
