import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function PATCH(request) {
    try {
        const { fullName, isActive } = await request.json();

        if (!fullName || typeof isActive !== 'boolean') {
            return NextResponse.json(
                { error: 'Invalid request. fullName and isActive (boolean) are required.' },
                { status: 400 },
            );
        }

        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('repositories');

        const result = await collection.updateOne(
            { fullName },
            {
                $set: {
                    isActive,
                    lastSynced: new Date(),
                },
            },
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'Repository not found in database' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: `Repository ${isActive ? 'activated' : 'deactivated'} successfully`,
            isActive,
        });
    } catch (error) {
        console.error('Error toggling repo active status:', error);
        return NextResponse.json({ error: error.message || 'Failed to toggle repository status' }, { status: 500 });
    }
}
