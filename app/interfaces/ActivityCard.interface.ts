import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { ReadonlyURLSearchParams } from 'next/navigation';
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
    router: AppRouterInstance;
    pathname: string;
    searchParams: ReadonlyURLSearchParams;
}
