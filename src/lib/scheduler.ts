import prisma from './db';
import { fetchCraigslistListings, closeBrowser } from './craigslist';
import { evaluateListing, DealEvaluation } from './ai-evaluator';
import { sendDealAlertEmail, DealAlert } from './email';

/**
 * Process a single search - fetch listings, evaluate, and send alerts
 */
export async function processSearch(searchId: string): Promise<{
    newListings: number;
    goodDeals: number;
    alertsSent: number;
}> {
    const search = await prisma.search.findUnique({
        where: { id: searchId },
        include: { user: true },
    });

    if (!search || !search.isActive) {
        return { newListings: 0, goodDeals: 0, alertsSent: 0 };
    }

    console.log(`Processing search: "${search.query}" for ${search.user.email}`);

    // Fetch listings from Craigslist using Playwright
    const listings = await fetchCraigslistListings(search.query, search.zipcode, {
        minPrice: search.minPrice ? search.minPrice / 100 : undefined, // Convert from cents
        maxPrice: search.maxPrice ? search.maxPrice / 100 : undefined,
        limit: 15, // Limit to avoid too many API calls
    });

    console.log(`Fetched ${listings.length} listings from Craigslist`);

    let newListings = 0;
    let goodDeals = 0;
    const dealsToAlert: DealAlert[] = [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY not set');
        return { newListings: 0, goodDeals: 0, alertsSent: 0 };
    }

    for (const listing of listings) {
        // Check if listing already exists
        const existingListing = await prisma.listing.findUnique({
            where: {
                searchId_externalId: {
                    searchId: search.id,
                    externalId: listing.externalId,
                },
            },
        });

        if (existingListing) {
            continue; // Skip already processed listings
        }

        // Evaluate the listing with AI (including web search, images, and user preferences)
        const evaluation: DealEvaluation = await evaluateListing(
            {
                title: listing.title,
                price: listing.price,
                description: listing.description,
                imageUrls: listing.imageUrls || [],
                query: search.query,
                preferences: search.preferences || undefined,
            },
            apiKey
        );

        // Build deal reason with market comparison
        const dealReason = [
            evaluation.reasoning,
            evaluation.marketComparison,
        ].filter(Boolean).join(' ');

        // Store the listing with enhanced data
        const savedListing = await prisma.listing.create({
            data: {
                searchId: search.id,
                externalId: listing.externalId,
                title: listing.title,
                price: listing.price,
                url: listing.url,
                description: listing.description,
                imageUrl: listing.imageUrl,
                location: listing.location,
                postedAt: listing.postedAt,
                dealScore: evaluation.score,
                dealReason: dealReason,
                isGoodDeal: evaluation.isGoodDeal,
                alertSent: false,
                identifiedProduct: evaluation.identifiedProduct,
                retailPriceLow: evaluation.retailPriceRange?.low || null,
                retailPriceHigh: evaluation.retailPriceRange?.high || null,
                condition: evaluation.condition,
            },
        });

        newListings++;

        if (savedListing.isGoodDeal) {
            goodDeals++;
            dealsToAlert.push({
                title: savedListing.title,
                price: savedListing.price,
                url: savedListing.url,
                dealScore: savedListing.dealScore!,
                reasoning: evaluation.reasoning,
                imageUrl: savedListing.imageUrl,
                identifiedProduct: evaluation.identifiedProduct,
                retailPriceRange: evaluation.retailPriceRange,
                condition: evaluation.condition,
                marketComparison: evaluation.marketComparison,
            });
        }

        // Rate limiting - wait 1.5 seconds between AI calls
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // Update last checked timestamp
    await prisma.search.update({
        where: { id: search.id },
        data: { lastChecked: new Date() },
    });

    // Send email alert if there are good deals
    let alertsSent = 0;
    if (dealsToAlert.length > 0) {
        const emailSent = await sendDealAlertEmail({
            recipientEmail: search.user.email,
            recipientName: search.user.name ?? undefined,
            searchQuery: search.query,
            zipcode: search.zipcode,
            deals: dealsToAlert,
        });

        if (emailSent) {
            // Mark listings as alerted
            await prisma.listing.updateMany({
                where: {
                    searchId: search.id,
                    isGoodDeal: true,
                    alertSent: false,
                },
                data: { alertSent: true },
            });
            alertsSent = dealsToAlert.length;
            console.log(`Sent alert email with ${alertsSent} deals`);
        }
    }

    console.log(
        `Search results: ${newListings} new listings, ${goodDeals} good deals, ${alertsSent} alerts sent`
    );

    return { newListings, goodDeals, alertsSent };
}

/**
 * Process all active searches
 */
export async function processAllSearches(): Promise<{
    searchesProcessed: number;
    totalNewListings: number;
    totalGoodDeals: number;
    totalAlertsSent: number;
}> {
    console.log('Starting scheduled job: Processing all active searches');

    const activeSearches = await prisma.search.findMany({
        where: { isActive: true },
        include: { user: true },
    });

    console.log(`Found ${activeSearches.length} active searches`);

    let totalNewListings = 0;
    let totalGoodDeals = 0;
    let totalAlertsSent = 0;

    try {
        for (const search of activeSearches) {
            try {
                const result = await processSearch(search.id);
                totalNewListings += result.newListings;
                totalGoodDeals += result.goodDeals;
                totalAlertsSent += result.alertsSent;
            } catch (error) {
                console.error(`Error processing search ${search.id}:`, error);
            }

            // Wait 3 seconds between searches to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    } finally {
        // Clean up browser instance
        await closeBrowser();
    }

    console.log(
        `Job complete: ${activeSearches.length} searches processed, ${totalNewListings} new listings, ${totalGoodDeals} good deals, ${totalAlertsSent} alerts sent`
    );

    return {
        searchesProcessed: activeSearches.length,
        totalNewListings,
        totalGoodDeals,
        totalAlertsSent,
    };
}
