import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

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

// POST /api/searches - Create a new search
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            email,
            query,
            zipcode,
            maxPrice,
            minPrice,
            bikeType,
            frameSize,
            condition,
            height,
        } = body;

        if (!email || !query || !zipcode) {
            return NextResponse.json(
                { error: 'Email, query, and zipcode are required' },
                { status: 400 }
            );
        }

        // Validate zipcode format
        if (!/^\d{5}$/.test(zipcode)) {
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
                data: {
                    email,
                    height: height ? parseInt(height, 10) : null,
                },
            });
        } else if (height && user.height !== parseInt(height, 10)) {
            // Update height if provided and different
            user = await prisma.user.update({
                where: { email },
                data: { height: parseInt(height, 10) },
            });
        }

        // Create the search with personalization
        const search = await prisma.search.create({
            data: {
                userId: user.id,
                query: query.trim(),
                zipcode,
                maxPrice: maxPrice ? parseInt(maxPrice, 10) : null,
                minPrice: minPrice ? parseInt(minPrice, 10) : null,
                bikeType: bikeType || null,
                frameSize: frameSize || null,
                condition: condition || null,
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
