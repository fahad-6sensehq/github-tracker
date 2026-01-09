import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function DELETE(request) {
    try {
        const { fullName } = await request.json();

        if (!fullName) {
            return NextResponse.json({ error: 'Repository fullName is required.' }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('repositories');

        // Delete the repository by fullName
        const result = await collection.deleteOne({ fullName });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: 'Repository not found in database.' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Repository deleted successfully',
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting repository:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete repository' }, { status: 500 });
    }
}
