import { CommitDetail, PRDetail } from './ActivityModel.interface';

export interface ActivityRecord {
    date: string;
    commits: number;
    prs: number;
    linesAdded?: number;
    linesDeleted?: number;
    filesChanged?: number;
    repositories?: string[];
    commitDetails?: CommitDetail[];
    prDetails?: PRDetail[];
    issues?: number;
    reviews?: number;
}

export interface ActivityCardProps {
    activity: ActivityRecord[];
    loading: boolean;
}
