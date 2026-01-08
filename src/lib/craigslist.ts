import { chromium, Browser, Page } from 'playwright';

// Craigslist region mapping - maps zip code prefixes to Craigslist regions
const ZIP_TO_REGION: Record<string, string> = {
    // California
    '940': 'sfbay', '941': 'sfbay', '942': 'sfbay', '943': 'sfbay', '944': 'sfbay',
    '945': 'sfbay', '946': 'sfbay', '947': 'sfbay', '948': 'sfbay', '949': 'sfbay',
    '950': 'sfbay', '951': 'inlandempire', '952': 'inlandempire',
    '900': 'losangeles', '901': 'losangeles', '902': 'losangeles', '903': 'losangeles',
    '904': 'losangeles', '905': 'losangeles', '906': 'losangeles', '907': 'losangeles',
    '908': 'losangeles', '910': 'losangeles', '911': 'losangeles', '912': 'losangeles',
    '913': 'losangeles', '914': 'losangeles', '915': 'losangeles', '916': 'losangeles',
    '917': 'losangeles', '918': 'losangeles', '920': 'sandiego', '921': 'sandiego',
    '922': 'sandiego', '958': 'sacramento', '959': 'sacramento', '956': 'sacramento',
    // New York
    '100': 'newyork', '101': 'newyork', '102': 'newyork', '103': 'newyork',
    '104': 'newyork', '110': 'newyork', '111': 'newyork', '112': 'newyork',
    '113': 'newyork', '114': 'newyork',
    // Texas
    '750': 'dallas', '751': 'dallas', '752': 'dallas', '753': 'dallas',
    '770': 'houston', '771': 'houston', '772': 'houston', '773': 'houston',
    '774': 'houston', '775': 'houston', '787': 'austin', '786': 'austin',
    // Illinois
    '606': 'chicago', '607': 'chicago', '608': 'chicago', '600': 'chicago',
    // Washington
    '980': 'seattle', '981': 'seattle', '982': 'seattle', '983': 'seattle',
    '984': 'seattle',
    // Colorado
    '802': 'denver', '803': 'denver', '804': 'denver', '800': 'denver', '801': 'denver',
    // Massachusetts
    '021': 'boston', '022': 'boston', '020': 'boston', '024': 'boston',
    // Georgia
    '303': 'atlanta', '300': 'atlanta', '301': 'atlanta', '302': 'atlanta',
    // Florida
    '331': 'miami', '330': 'miami', '332': 'miami', '333': 'miami',
    // Arizona
    '850': 'phoenix', '851': 'phoenix', '852': 'phoenix', '853': 'phoenix',
    // Michigan
    '481': 'detroit', '482': 'detroit', '480': 'detroit', '483': 'detroit',
    // Pennsylvania
    '191': 'philadelphia', '190': 'philadelphia', '192': 'philadelphia',
    // Oregon
    '972': 'portland', '970': 'portland', '971': 'portland', '973': 'portland',
    // Minnesota
    '554': 'minneapolis', '553': 'minneapolis', '550': 'minneapolis', '551': 'minneapolis',
};

// Category mapping for Craigslist
const CATEGORY_MAP: Record<string, string> = {
    'bicycle': 'bia',
    'bike': 'bia',
    'car': 'cta',
    'auto': 'cta',
    'furniture': 'fua',
    'electronics': 'ela',
    'computer': 'sya',
    'laptop': 'sya',
    'phone': 'moa',
    'motorcycle': 'mca',
    'default': 'sss', // all for sale
};

export interface CraigslistListing {
    externalId: string;
    title: string;
    price: number | null;
    url: string;
    description: string | null;
    imageUrl: string | null;
    imageUrls: string[]; // All images for the listing
    location: string | null;
    postedAt: Date | null;
}

/**
 * Get the Craigslist region for a given zip code
 */
export function getRegionFromZipcode(zipcode: string): string {
    const prefix3 = zipcode.substring(0, 3);
    return ZIP_TO_REGION[prefix3] || 'sfbay'; // Default to SF Bay Area
}

/**
 * Get the Craigslist category code for a search query
 */
export function getCategoryFromQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
        if (lowerQuery.includes(keyword)) {
            return category;
        }
    }
    return CATEGORY_MAP['default'];
}

/**
 * Build the Craigslist search URL
 */
export function buildSearchUrl(
    query: string,
    zipcode: string,
    options?: { minPrice?: number; maxPrice?: number; radius?: number }
): string {
    const region = getRegionFromZipcode(zipcode);
    const category = getCategoryFromQuery(query);

    const params = new URLSearchParams({
        query: query,
        postal: zipcode,
        search_distance: (options?.radius || 25).toString(),
        sort: 'date',
        postedToday: '1', // Only today's listings
    });

    if (options?.minPrice) {
        params.set('min_price', options.minPrice.toString());
    }
    if (options?.maxPrice) {
        params.set('max_price', options.maxPrice.toString());
    }

    return `https://${region}.craigslist.org/search/${category}?${params.toString()}`;
}

/**
 * Build the RSS feed URL (for reference)
 */
export function buildRssUrl(
    query: string,
    zipcode: string,
    options?: { minPrice?: number; maxPrice?: number }
): string {
    return buildSearchUrl(query, zipcode, options) + '&format=rss';
}

// Browser singleton for reuse
let browserInstance: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
    if (!browserInstance) {
        browserInstance = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
            ],
        });
    }
    return browserInstance;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

/**
 * Extract listing ID from Craigslist URL
 */
function extractListingId(url: string): string {
    const match = url.match(/\/(\d+)\.html/);
    return match ? match[1] : url;
}

/**
 * Fetch listing details including images and description
 */
export async function fetchListingDetails(
    listingUrl: string,
    page: Page
): Promise<{ description: string; imageUrls: string[] }> {
    try {
        await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait for content to load
        await page.waitForSelector('body', { timeout: 5000 });

        // Get description
        const description = await page.$eval(
            '#postingbody',
            (el) => el.textContent?.trim() || ''
        ).catch(() => '');

        // Get all image URLs
        const imageUrls = await page.$$eval(
            '.gallery img, .swipe img, .thumb img, img[src*="images.craigslist.org"]',
            (imgs) => imgs.map((img) => (img as HTMLImageElement).src || img.getAttribute('data-src') || '').filter(Boolean)
        ).catch(() => []);

        return { description, imageUrls };
    } catch (error) {
        console.error(`Error fetching listing details from ${listingUrl}:`, error);
        return { description: '', imageUrls: [] };
    }
}

/**
 * Fetch listings from Craigslist using Playwright
 */
export async function fetchCraigslistListings(
    query: string,
    zipcode: string,
    options?: { minPrice?: number; maxPrice?: number; limit?: number }
): Promise<CraigslistListing[]> {
    const searchUrl = buildSearchUrl(query, zipcode, options);
    const limit = options?.limit || 20;

    console.log(`Fetching Craigslist with Playwright: ${searchUrl}`);

    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    try {
        // Navigate to search page
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for listings to load
        await page.waitForSelector('.cl-search-result, .result-row, li.cl-static-search-result', { timeout: 10000 });

        // Extract basic listing info from search results
        const basicListings = await page.$$eval(
            '.cl-search-result, .result-row, li.cl-static-search-result',
            (elements, maxItems) => {
                return elements.slice(0, maxItems).map((el) => {
                    const linkEl = el.querySelector('a.cl-app-anchor, a.titlestring, a.result-title');
                    const url = linkEl?.getAttribute('href') || '';
                    const title = linkEl?.textContent?.trim() || '';

                    const priceEl = el.querySelector('.priceinfo, .result-price, .price');
                    const priceText = priceEl?.textContent?.trim() || '';
                    const priceMatch = priceText.match(/\$?([\d,]+)/);
                    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;

                    const imgEl = el.querySelector('img');
                    const imageUrl = imgEl?.getAttribute('src') || null;

                    const locationEl = el.querySelector('.meta .location, .result-hood');
                    const location = locationEl?.textContent?.trim() || null;

                    const timeEl = el.querySelector('time');
                    const dateStr = timeEl?.getAttribute('datetime') || null;

                    return { url, title, price, imageUrl, location, dateStr };
                });
            },
            limit
        );

        console.log(`Found ${basicListings.length} listings on search page`);

        // Fetch details for each listing (with concurrency limit)
        const listings: CraigslistListing[] = [];

        for (const basic of basicListings.slice(0, Math.min(10, basicListings.length))) {
            if (!basic.url || !basic.title) continue;

            const fullUrl = basic.url.startsWith('http')
                ? basic.url
                : `https://${getRegionFromZipcode(zipcode)}.craigslist.org${basic.url}`;

            // Fetch full details
            const details = await fetchListingDetails(fullUrl, page);

            listings.push({
                externalId: extractListingId(basic.url),
                title: basic.title,
                price: basic.price ? basic.price * 100 : null, // Convert to cents
                url: fullUrl,
                description: details.description || null,
                imageUrl: basic.imageUrl || details.imageUrls[0] || null,
                imageUrls: details.imageUrls,
                location: basic.location,
                postedAt: basic.dateStr ? new Date(basic.dateStr) : null,
            });

            // Small delay between requests
            await page.waitForTimeout(500);
        }

        console.log(`Fetched details for ${listings.length} listings`);
        return listings;
    } catch (error) {
        console.error('Error fetching Craigslist:', error);
        return [];
    } finally {
        await context.close();
    }
}
