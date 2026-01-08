export interface Repository {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    ownerType: string;
    organization: string | null;
    description: string | null;
    private: boolean;
    url: string;
    updatedAt: string;
    language: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
    isActive?: boolean;
    inDb?: boolean;
    _id?: string;
}
