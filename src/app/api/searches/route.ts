import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkRateLimit, isSuspiciousRequest, getClientIP, RATE_LIMITS } from '@/lib/security';

// GET /api/searches - List all searches
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                searches: {
                    include: {
                        listings: {
                            orderBy: { createdAt: 'desc' },
                            take: 20,
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ searches: [] });
        }

        return NextResponse.json({ searches: user.searches });
    } catch (error) {
        console.error('Error fetching searches:', error);
        return NextResponse.json(
            { error: 'Failed to fetch searches' },
            { status: 500 }
        );
    }
}

// POST /api/searches - Create a new search (Legacy/Manual Endpoint)
export async function POST(request: NextRequest) {
    // Basic security checks
    const clientIP = getClientIP(request);
    if (isSuspiciousRequest(request)) {
        return NextResponse.json({ error: 'Request blocked' }, { status: 403 });
    }

    // Rate limit
    const rateLimit = checkRateLimit(`create_search:${clientIP}`, RATE_LIMITS.createAlert);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: `Too many requests. Try again in ${rateLimit.resetIn} seconds.` },
            { status: 429 }
        );
    }

    try {
        const body = await request.json();
        const {
            email,
            query,
            zipcode,
            maxPrice,
            radius,
            preferences, // Generic preferences object or JSON string
        } = body;

        if (!email || !query || !zipcode) {
            return NextResponse.json(
                { error: 'Email, query, and zipcode are required' },
                { status: 400 }
            );
        }

        // Validate zipcode format
        if (!/^\d{5}(-\d{4})?$/.test(zipcode)) {
            return NextResponse.json(
                { error: 'Invalid zipcode format' },
                { status: 400 }
            );
        }

        // Find or create user
        let user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            user = await prisma.user.create({
                data: { email },
            });
        }

        // Check search limit
        const activeSearches = await prisma.search.count({
            where: { userId: user.id, isActive: true }
        });

        if (activeSearches >= 10) {
            return NextResponse.json(
                { error: 'Maximum of 10 active searches allowed' },
                { status: 400 }
            );
        }

        // Parse preferences if it's a string, or stringify if it's an object
        // The DB stores it as a string
        let preferencesString = null;
        if (typeof preferences === 'string') {
            preferencesString = preferences;
        } else if (preferences) {
            preferencesString = JSON.stringify(preferences);
        }

        // Create the search
        const search = await prisma.search.create({
            data: {
                userId: user.id,
                query: query.trim(),
                zipcode,
                radius: radius ? parseInt(radius, 10) : 25,
                maxPrice: maxPrice ? parseInt(maxPrice, 10) : null,
                preferences: preferencesString,
            },
        });

        return NextResponse.json({ search }, { status: 201 });
    } catch (error) {
        console.error('Error creating search:', error);
        return NextResponse.json(
            { error: 'Failed to create search' },
            { status: 500 }
        );
    }
}
