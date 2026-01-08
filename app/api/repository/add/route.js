import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const repo = await request.json();

        if (!repo || !repo.fullName) {
            return NextResponse.json({ error: 'Invalid request. Repository data is required.' }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('repositories');

        const result = await collection.updateOne(
            { fullName: repo.fullName },
            {
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
            { upsert: true },
        );

        return NextResponse.json({
            success: true,
            message: 'Repository added successfully',
            inserted: result.upsertedCount > 0,
        });
    } catch (error) {
        console.error('Error adding repo:', error);
        return NextResponse.json({ error: error.message || 'Failed to add repository' }, { status: 500 });
    }
}
