import { NextRequest, NextResponse } from 'next/server';
import { processAllSearches } from '@/lib/scheduler';

/**
 * Cron endpoint for scheduled scans
 * 
 * This should be called by:
 * - Vercel Cron (vercel.json config)
 * - External scheduler (cron-job.org, etc.)
 * - GitHub Actions
 * 
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized cron attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Also allow Vercel's internal cron header
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    if (!cronSecret && !vercelCronHeader) {
        // In development, allow without auth
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    console.log(`[${new Date().toISOString()}] Starting scheduled scan...`);

    try {
        const result = await processAllSearches();

        console.log(`[${new Date().toISOString()}] Scan complete:`, result);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result,
        });
    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { error: 'Scan failed', message: String(error) },
            { status: 500 }
        );
    }
}

// Also allow POST for webhooks
export async function POST(request: NextRequest) {
    return GET(request);
}
