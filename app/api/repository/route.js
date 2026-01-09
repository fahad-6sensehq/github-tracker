import clientPromise from '@/lib/mongodb';
import { fetchAllRepos } from '@/lib/repo-sync';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Get access token from environment variable
        const accessToken = process.env.GITHUB_TOKEN;

        if (!accessToken) {
            return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
        }

        // Fetch repos from GitHub
        const githubRepos = await fetchAllRepos(accessToken);

        // Fetch repos from database
        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('repositories');
        const dbRepos = await collection.find({}).toArray();

        // Create a map of repos in DB by fullName (unique identifier)
        const dbReposMap = new Map();
        dbRepos.forEach((repo) => {
            dbReposMap.set(repo.fullName, repo);
        });

        // Create a set of GitHub repo fullNames for quick lookup
        const githubReposSet = new Set(githubRepos.map((repo) => repo.fullName));

        // Merge GitHub repos with DB data
        const mergedRepos = githubRepos.map((repo) => {
            const dbRepo = dbReposMap.get(repo.fullName);
            if (dbRepo) {
                // Repo exists in DB
                return {
                    ...repo,
                    isActive: dbRepo.isActive || false,
                    inDb: true,
                    _id: dbRepo._id,
                    deletedFromGitHub: false,
                };
            } else {
                // Repo not in DB
                return {
                    ...repo,
                    isActive: false,
                    inDb: false,
                    deletedFromGitHub: false,
                };
            }
        });

        // Find repos that exist in DB but not on GitHub (deleted from GitHub)
        const deletedRepos = dbRepos
            .filter((dbRepo) => !githubReposSet.has(dbRepo.fullName))
            .map((dbRepo) => ({
                id: dbRepo.id,
                name: dbRepo.name,
                fullName: dbRepo.fullName,
                owner: dbRepo.owner,
                ownerType: dbRepo.ownerType,
                organization: dbRepo.organization,
                description: dbRepo.description,
                private: dbRepo.private,
                url: dbRepo.url,
                updatedAt: dbRepo.updatedAt,
                language: dbRepo.language,
                stars: dbRepo.stars,
                forks: dbRepo.forks,
                defaultBranch: dbRepo.defaultBranch,
                isActive: dbRepo.isActive || false,
                inDb: true,
                _id: dbRepo._id,
                deletedFromGitHub: true,
            }));

        // Combine merged repos with deleted repos
        const allRepos = [...mergedRepos, ...deletedRepos];

        return NextResponse.json({
            success: true,
            data: allRepos,
            count: allRepos.length,
        });
    } catch (error) {
        console.error('Error in /api/repo:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to fetch repositories',
                details: error.status ? `GitHub API error: ${error.status}` : undefined,
            },
            { status: error.status || 500 },
        );
    }
}

export async function POST(request) {
    try {
        const { repos } = await request.json();

        if (!repos || !Array.isArray(repos)) {
            return NextResponse.json({ error: 'Invalid request. repos array is required.' }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('repositories');

        // Prepare bulk operations
        const bulkOps = repos.map((repo) => ({
            updateOne: {
                filter: { fullName: repo.fullName },
                update: {
                    $set: {
                        id: repo.id,
                        name: repo.name,
                        fullName: repo.fullName,
                        owner: repo.owner,
                        ownerType: repo.ownerType,
                        organization: repo.organization,
                        description: repo.description,
                        private: repo.private,
                        url: repo.url,
                        updatedAt: repo.updatedAt,
                        language: repo.language,
                        stars: repo.stars,
                        forks: repo.forks,
                        defaultBranch: repo.defaultBranch,
                        isActive: repo.isActive !== undefined ? repo.isActive : false,
                        lastSynced: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps);
        }

        return NextResponse.json({
            success: true,
            message: `Saved ${repos.length} repository${repos.length !== 1 ? 'ies' : ''}`,
            count: repos.length,
        });
    } catch (error) {
        console.error('Error saving repos:', error);
        return NextResponse.json({ error: error.message || 'Failed to save repositories' }, { status: 500 });
    }
}
