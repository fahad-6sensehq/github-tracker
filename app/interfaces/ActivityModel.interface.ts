export interface CommitDetail {
    sha: string;
    message: string;
    repository: string;
    url: string;
    additions: number;
    deletions: number;
    filesChanged: number;
    timestamp: string;
}

export interface PRDetail {
    number: number;
    title: string;
    repository: string;
    state: string;
    url: string;
    merged: boolean;
    createdAt: string;
    closedAt?: string;
    mergedAt?: string;
    comments: number;
    labels: string[];
}

export interface ActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string;
    commits: number;
    prs: number;
    linesAdded: number;
    linesDeleted: number;
    filesChanged: number;
    repositories: string[];
    commitDetails: CommitDetail[];
    prDetails: PRDetail[];
    issues: number;
}
