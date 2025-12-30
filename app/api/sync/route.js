import { fetchGitHubActivity } from '@/lib/github';
import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { startDate, endDate, daysBack } = await request.json();

        let start, end;
        if (startDate && endDate) {
            start = startDate;
            end = endDate;
        } else {
            end = new Date();
            start = new Date();
            start.setDate(start.getDate() - (daysBack || 30));
            start = start.toISOString().split('T')[0];
            end = end.toISOString().split('T')[0];
        }

        const dailyStats = await fetchGitHubActivity(start, end);

        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('daily_activity');

        const bulkOps = Object.entries(dailyStats).map(([date, stats]) => ({
            updateOne: {
                filter: { date },
                update: {
                    $set: {
                        date,
                        commits: stats.commits,
                        prs: stats.prs,
                        linesAdded: stats.linesAdded || 0,
                        linesDeleted: stats.linesDeleted || 0,
                        filesChanged: stats.filesChanged || 0,
                        repositories: stats.repositories || [],
                        commitDetails: stats.commitDetails || [],
                        prDetails: stats.prDetails || [],
                        issues: stats.issues || 0,
                        reviews: stats.reviews || 0,
                        updatedAt: new Date()
                    }
                },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps);
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${Object.keys(dailyStats).length} days`,
            data: dailyStats
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
