/**
 * Test script to verify Craigslist Playwright scraping and enhanced AI evaluation
 * Run with: npx tsx scripts/test-backend.ts
 */

import { fetchCraigslistListings, closeBrowser, getRegionFromZipcode, buildSearchUrl } from '../src/lib/craigslist';
import { evaluateListing, DealEvaluation } from '../src/lib/ai-evaluator';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testCraigslistFetch() {
    console.log('='.repeat(60));
    console.log('🔍 TESTING CRAIGSLIST FETCH WITH PLAYWRIGHT');
    console.log('='.repeat(60));

    const zipcode = '94110';
    const query = 'bicycle';

    console.log(`\nZipcode: ${zipcode}`);
    console.log(`Region: ${getRegionFromZipcode(zipcode)}`);
    console.log(`Query: ${query}`);
    console.log(`Search URL: ${buildSearchUrl(query, zipcode)}\n`);

    console.log('Launching Playwright browser...\n');

    const listings = await fetchCraigslistListings(query, zipcode, {
        maxPrice: 800,
        limit: 5 // Limit for testing
    });

    console.log(`\n✅ Found ${listings.length} listings\n`);

    if (listings.length === 0) {
        console.log('❌ No listings found. Playwright may have been blocked.');
        return [];
    }

    // Show listings with details
    console.log('Listings found:');
    console.log('-'.repeat(60));

    listings.forEach((listing, i) => {
        console.log(`\n${i + 1}. ${listing.title}`);
        console.log(`   Price: ${listing.price ? `$${listing.price / 100}` : 'Not listed'}`);
        console.log(`   URL: ${listing.url}`);
        console.log(`   Images: ${listing.imageUrls?.length || 0}`);
        console.log(`   Description: ${listing.description?.substring(0, 100) || 'N/A'}...`);
    });

    return listings;
}

async function testAIEvaluation(listings: Awaited<ReturnType<typeof fetchCraigslistListings>>) {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 TESTING ENHANCED AI EVALUATION WITH WEB SEARCH');
    console.log('='.repeat(60));

    let listingToEvaluate;

    if (listings.length === 0) {
        console.log('\n⚠️ No real listings to evaluate. Using mock data...\n');

        // Use mock listing for testing
        listingToEvaluate = {
            title: 'Specialized Sirrus 3.0 Hybrid Bike - Like New',
            price: 45000, // $450
            description: 'Specialized Sirrus 3.0 hybrid bike, purchased in 2023. Only ridden a few times, basically new condition. Carbon fork, hydraulic disc brakes, 2x9 drivetrain. Size Medium. Moving and must sell!',
            imageUrls: [],
            query: 'bicycle',
        };
    } else {
        const listing = listings[0];
        listingToEvaluate = {
            title: listing.title,
            price: listing.price,
            description: listing.description,
            imageUrls: listing.imageUrls || [],
            query: 'bicycle',
        };
    }

    console.log('Listing to evaluate:');
    console.log(`  Title: ${listingToEvaluate.title}`);
    console.log(`  Price: ${listingToEvaluate.price ? `$${listingToEvaluate.price / 100}` : 'Not listed'}`);
    console.log(`  Images: ${listingToEvaluate.imageUrls.length}`);
    console.log(`  Description: ${listingToEvaluate.description?.substring(0, 100) || 'N/A'}...\n`);

    console.log('Evaluating with Gemini 2.0 Flash (with web search)...\n');

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
    const evaluation: DealEvaluation = await evaluateListing(listingToEvaluate, GEMINI_API_KEY);

    console.log('🎯 AI Evaluation Result:');
    console.log('-'.repeat(50));
    console.log(`  Score: ${evaluation.score}/100 ${evaluation.isGoodDeal ? '✅ GOOD DEAL' : '❌ NOT A DEAL'}`);
    console.log(`  Identified Product: ${evaluation.identifiedProduct || 'Unknown'}`);
    console.log(`  Condition: ${evaluation.condition}`);

    if (evaluation.retailPriceRange) {
        console.log(`  Retail Price Range: $${evaluation.retailPriceRange.low / 100} - $${evaluation.retailPriceRange.high / 100}`);
    } else {
        console.log(`  Retail Price Range: Unable to determine`);
    }

    console.log(`  Market Comparison: ${evaluation.marketComparison}`);
    console.log(`  Reasoning: ${evaluation.reasoning}`);

    return evaluation;
}

async function main() {
    console.log('\n🚀 DEALFINDER ENHANCED BACKEND TEST\n');
    console.log('This test uses Playwright for scraping and Gemini 2.0 Flash with web search.\n');

    try {
        const listings = await testCraigslistFetch();
        await testAIEvaluation(listings);

        console.log('\n' + '='.repeat(60));
        console.log('✅ BACKEND TEST COMPLETE');
        console.log('='.repeat(60) + '\n');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Clean up browser
        await closeBrowser();
    }
}

main();
