import { GoogleGenerativeAI, GoogleSearchRetrievalTool } from '@google/generative-ai';

export interface DealEvaluation {
    score: number;
    isGoodDeal: boolean;
    reasoning: string;
    identifiedProduct: string | null;
    retailPriceRange: { low: number; high: number } | null;
    condition: string;
    marketComparison: string;
}

export interface ListingForEvaluation {
    title: string;
    price: number | null;
    description: string | null;
    imageUrls: string[];
    query: string;
    preferences?: string; // JSON string of user preferences
}

const EVALUATION_PROMPT = `You are an expert at evaluating Craigslist listings to find good deals.

TASK: Analyze this listing and determine if it's a good deal by:
1. Identifying the exact product (brand, model, year if applicable)
2. Searching the web for typical retail and used market prices
3. Comparing the listing price to market values
4. Assessing condition from description and photos

USER IS SEARCHING FOR: {query}
USER PREFERENCES: {preferences}

LISTING:
- Title: {title}
- Price: {price}
- Description: {description}

EVALUATION CRITERIA:
- Is this what the user is looking for?
- Is the price good compared to market value?
- What's the condition?
- Any red flags or concerns?

SCORING:
- 80-100: Exceptional deal - 40%+ below market
- 70-79: Good deal - 20-40% below market
- 50-69: Fair price - Around market value
- 30-49: Overpriced or not quite what user wants
- 1-29: Skip - Wrong item, scam indicators, or very overpriced

A "good deal" requires score >= 70.

RESPOND WITH ONLY THIS JSON (no markdown):
{
    "score": <1-100>,
    "isGoodDeal": <boolean>,
    "identifiedProduct": "<brand model>" or null,
    "retailPriceRange": {"low": <cents>, "high": <cents>} or null,
    "condition": "excellent" | "good" | "fair" | "poor" | "unknown",
    "marketComparison": "<1 sentence comparing to market>",
    "reasoning": "<2-3 sentences about this listing>"
}`;

function formatPrice(priceInCents: number | null): string {
    if (priceInCents === null) return 'Not listed';
    return `$${(priceInCents / 100).toLocaleString()}`;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        return {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: response.headers.get('content-type') || 'image/jpeg',
        };
    } catch {
        return null;
    }
}

export async function evaluateListing(
    listing: ListingForEvaluation,
    apiKey: string
): Promise<DealEvaluation> {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        tools: [{ googleSearch: {} } as GoogleSearchRetrievalTool],
    });

    const prompt = EVALUATION_PROMPT
        .replace('{query}', listing.query)
        .replace('{preferences}', listing.preferences || 'None specified')
        .replace('{title}', listing.title)
        .replace('{price}', formatPrice(listing.price))
        .replace('{description}', listing.description || 'No description');

    try {
        const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
            { text: prompt },
        ];

        for (const imageUrl of listing.imageUrls.slice(0, 2)) {
            const imageData = await fetchImageAsBase64(imageUrl);
            if (imageData) parts.push({ inlineData: imageData });
        }

        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) throw new Error('No JSON in response');
        const evaluation = JSON.parse(jsonMatch[0]) as DealEvaluation;

        evaluation.score = Math.max(1, Math.min(100, Math.round(evaluation.score)));
        evaluation.isGoodDeal = evaluation.score >= 70;

        return evaluation;
    } catch (error) {
        console.error('Evaluation error:', error);
        return {
            score: 50,
            isGoodDeal: false,
            reasoning: 'Unable to evaluate automatically.',
            identifiedProduct: null,
            retailPriceRange: null,
            condition: 'unknown',
            marketComparison: 'Unable to compare.',
        };
    }
}
