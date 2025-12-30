import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDateStr = searchParams.get('startDate'); // YYYY-MM-DD format
        const endDateStr = searchParams.get('endDate'); // YYYY-MM-DD format

        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('daily_activity');

        // Convert DD-MM-YYYY string to Date object
        const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split('-');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        };

        // Convert YYYY-MM-DD to Date object
        const parseYYYYMMDD = (dateStr) => {
            const [year, month, day] = dateStr.split('-');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        };

        // Fetch all records (or use a rough filter if we have too many)
        const allRecords = await collection
            .find({})
            .toArray();

        // Filter records by date range if provided
        let filteredRecords = allRecords;

        if (startDateStr && endDateStr) {
            const startDate = parseYYYYMMDD(startDateStr);
            const endDate = parseYYYYMMDD(endDateStr);

            filteredRecords = allRecords.filter(record => {
                const recordDate = parseDate(record.date);
                return recordDate >= startDate && recordDate <= endDate;
            });
        } else if (startDateStr) {
            const startDate = parseYYYYMMDD(startDateStr);
            filteredRecords = allRecords.filter(record => {
                const recordDate = parseDate(record.date);
                return recordDate >= startDate;
            });
        } else if (endDateStr) {
            const endDate = parseYYYYMMDD(endDateStr);
            filteredRecords = allRecords.filter(record => {
                const recordDate = parseDate(record.date);
                return recordDate <= endDate;
            });
        }

        // Sort by date (newest first)
        const sortedRecords = filteredRecords.sort((a, b) => {
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            return dateB - dateA; // Descending order
        });

        return NextResponse.json({ success: true, data: sortedRecords });
    } catch (error) {
        console.error('Error in /api/activity:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
