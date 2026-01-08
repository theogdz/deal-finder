import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processSearch } from '@/lib/scheduler';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/security';

// GET /api/searches/[id] - Get a specific search with listings
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const search = await prisma.search.findUnique({
            where: { id },
            include: {
                user: true,
                listings: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!search) {
            return NextResponse.json(
                { error: 'Search not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ search });
    } catch (error) {
        console.error('Error fetching search:', error);
        return NextResponse.json(
            { error: 'Failed to fetch search' },
            { status: 500 }
        );
    }
}

// DELETE /api/searches/[id] - Delete a search
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.search.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting search:', error);
        return NextResponse.json(
            { error: 'Failed to delete search' },
            { status: 500 }
        );
    }
}

// PATCH /api/searches/[id] - Update search (toggle active, etc.)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { isActive } = body;

        const search = await prisma.search.update({
            where: { id },
            data: { isActive },
        });

        return NextResponse.json({ search });
    } catch (error) {
        console.error('Error updating search:', error);
        return NextResponse.json(
            { error: 'Failed to update search' },
            { status: 500 }
        );
    }
}

// POST /api/searches/[id] - Trigger a manual scan for this search
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const clientIP = getClientIP(request);

    // Rate limit scans: 5 per hour per IP
    const rateLimit = checkRateLimit(`scan:${clientIP}`, RATE_LIMITS.scan);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: `Too many scan requests. Try again in ${Math.ceil(rateLimit.resetIn / 60)} minutes.`,
                resetIn: rateLimit.resetIn,
            },
            { status: 429 }
        );
    }

    try {
        const { id } = await params;

        const search = await prisma.search.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!search) {
            return NextResponse.json(
                { error: 'Search not found' },
                { status: 404 }
            );
        }

        // Also rate limit by user email
        const userRateLimit = checkRateLimit(`scan:${search.user.email}`, RATE_LIMITS.scan);
        if (!userRateLimit.allowed) {
            return NextResponse.json(
                {
                    error: `Too many scan requests for this account. Try again in ${Math.ceil(userRateLimit.resetIn / 60)} minutes.`,
                },
                { status: 429 }
            );
        }

        const result = await processSearch(id);

        return NextResponse.json({
            success: true,
            ...result
        }, {
            headers: {
                'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            }
        });
    } catch (error) {
        console.error('Error processing search:', error);
        return NextResponse.json(
            { error: 'Failed to process search' },
            { status: 500 }
        );
    }
}
