import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ConversationState {
    itemType: string | null;
    zipcode: string | null;
    radius: number | null;
    maxPrice: number | null;
    email: string | null;
    preferences: Record<string, unknown> | null;
    isComplete: boolean;
    needsConfirmation: boolean;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant for a Craigslist deal finder app. Your job is to help users set up alerts for items they want to find.

You need to gather the following information through natural conversation:
1. **What they're looking for** - Be specific (e.g., "road bike", "mid-century modern couch", "MacBook Pro")
2. **Location** - Get their zip code
3. **Search radius** - How far they're willing to travel (default 25 miles if not specified)
4. **Budget** - Maximum they want to spend (optional but encouraged)
5. **Email** - Where to send alerts

CONVERSATION GUIDELINES:
- Be friendly and conversational, not robotic
- Ask ONE question at a time
- If they give multiple pieces of info at once, acknowledge all of them
- Help them be specific about what they want (ask clarifying questions)
- For expensive items (cars, bikes, electronics), ask about preferred brands, condition, etc.
- Once you have all required info (item, zip, email), summarize and ask for confirmation

REQUIRED INFO:
- Item description (what they want)
- Zip code
- Email address

OPTIONAL BUT HELPFUL:
- Radius (default 25 miles)
- Budget/max price
- Specific preferences (brand, condition, size, etc.)

When you have enough information, provide a summary and ask them to confirm.

RESPONSE FORMAT:
Always respond with JSON in this exact format:
{
  "message": "Your conversational response here",
  "extracted": {
    "itemType": "what they're looking for" or null,
    "zipcode": "12345" or null,
    "radius": 25 or null,
    "maxPrice": 50000 (in cents) or null,
    "email": "email@example.com" or null,
    "preferences": {"brand": "Trek", "condition": "good"} or null
  },
  "needsConfirmation": false,
  "isComplete": false
}

Set needsConfirmation=true when you have all required info and are asking them to confirm.
Set isComplete=true ONLY after they explicitly confirm (say "yes", "looks good", "create it", etc.).`;

export async function processChat(
    messages: ChatMessage[],
    currentState: ConversationState,
    apiKey: string
): Promise<{ response: string; state: ConversationState }> {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
    });

    // Build conversation history with context
    const contextMessage = `Current extracted information:
${JSON.stringify(currentState, null, 2)}

Remember to respond with valid JSON only.`;

    const chatHistory = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
    }));

    try {
        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: '{"message": "Hi! I\'m here to help you find great deals on Craigslist. What are you looking for?", "extracted": {}, "needsConfirmation": false, "isComplete": false}' }] },
                ...chatHistory.slice(0, -1),
            ],
        });

        const lastMessage = messages[messages.length - 1];
        const result = await chat.sendMessage(`${contextMessage}\n\nUser message: ${lastMessage.content}`);
        const responseText = result.response.text().trim();

        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Merge extracted data with current state
        const newState: ConversationState = {
            itemType: parsed.extracted?.itemType || currentState.itemType,
            zipcode: parsed.extracted?.zipcode || currentState.zipcode,
            radius: parsed.extracted?.radius || currentState.radius,
            maxPrice: parsed.extracted?.maxPrice || currentState.maxPrice,
            email: parsed.extracted?.email || currentState.email,
            preferences: parsed.extracted?.preferences || currentState.preferences,
            isComplete: parsed.isComplete || false,
            needsConfirmation: parsed.needsConfirmation || false,
        };

        return {
            response: parsed.message,
            state: newState,
        };
    } catch (error) {
        console.error('Chat error:', error);
        return {
            response: "I'm having trouble understanding. Could you tell me what you're looking for?",
            state: currentState,
        };
    }
}

export function getInitialMessage(): string {
    return "Hi! I'll help you find great deals on Craigslist. What are you looking for?";
}

export function generateConfirmationSummary(state: ConversationState): string {
    const parts = [
        `**Looking for:** ${state.itemType}`,
        `**Location:** ${state.zipcode} (${state.radius || 25} mile radius)`,
    ];

    if (state.maxPrice) {
        parts.push(`**Max budget:** $${(state.maxPrice / 100).toLocaleString()}`);
    }

    parts.push(`**Email alerts to:** ${state.email}`);

    if (state.preferences && Object.keys(state.preferences).length > 0) {
        parts.push(`**Preferences:** ${JSON.stringify(state.preferences)}`);
    }

    return parts.join('\n');
}
