import clientPromise from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db('github_tracker');
        const collection = db.collection('daily_activity');

        // Get all distinct dates from database (DD-MM-YYYY format)
        const records = await collection
            .find({}, { projection: { date: 1 } })
            .toArray();

        if (records.length === 0) {
            return NextResponse.json({
                success: true,
                months: []
            });
        }

        // Convert DD-MM-YYYY dates to Date objects and sort
        const sortedDates = records
            .map(record => {
                const [day, month, year] = record.date.split('-');
                return {
                    dateStr: record.date,
                    dateObj: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
                    yearMonth: `${year}-${month}`
                };
            })
            .sort((a, b) => b.dateObj - a.dateObj); // Sort descending (newest first)

        // Extract unique months while maintaining order
        const uniqueMonths = [];
        const seenMonths = new Set();

        sortedDates.forEach(item => {
            if (!seenMonths.has(item.yearMonth)) {
                seenMonths.add(item.yearMonth);
                uniqueMonths.push(item.yearMonth);
            }
        });

        // Format months with full names
        const formattedMonths = uniqueMonths.map(yearMonth => {
            const [year, month] = yearMonth.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            const label = date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });

            return {
                value: yearMonth,
                label: label
            };
        });

        return NextResponse.json({
            success: true,
            months: formattedMonths
        });
    } catch (error) {
        console.error('Error fetching months:', error);
        return NextResponse.json({
            error: error.message,
            months: []
        }, { status: 500 });
    }
}
