import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { processChat, getInitialMessage, ConversationState, ChatMessage } from '@/lib/chat-agent';
import {
    checkRateLimit,
    getClientIP,
    sanitizeInput,
    isSuspiciousRequest,
    RATE_LIMITS
} from '@/lib/security';

// POST /api/chat - Send a message and get a response
export async function POST(request: NextRequest) {
    // Security checks
    const clientIP = getClientIP(request);

    // Check for suspicious requests (bots, etc.)
    if (isSuspiciousRequest(request)) {
        return NextResponse.json({ error: 'Request blocked' }, { status: 403 });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(`chat:${clientIP}`, RATE_LIMITS.chat);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: `Too many requests. Try again in ${rateLimit.resetIn} seconds.` },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateLimit.resetIn.toString(),
                }
            }
        );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { conversationId, message: rawMessage } = body;

        // Sanitize input
        const message = sanitizeInput(rawMessage);

        if (!message || message.length < 1) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        if (message.length > 500) {
            return NextResponse.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
        }

        let conversation;
        let messages: ChatMessage[] = [];

        if (conversationId) {
            conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { messages: { orderBy: { createdAt: 'asc' } } },
            });

            if (!conversation) {
                return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
            }

            // Limit conversation length to prevent abuse
            if (conversation.messages.length > 50) {
                return NextResponse.json(
                    { error: 'Conversation too long. Please start a new one.' },
                    { status: 400 }
                );
            }

            messages = conversation.messages.map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));
        } else {
            conversation = await prisma.conversation.create({ data: {} });
        }

        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                role: 'user',
                content: message,
            },
        });

        messages.push({ role: 'user', content: message });

        const currentState: ConversationState = {
            itemType: conversation.itemType,
            zipcode: conversation.zipcode,
            radius: conversation.radius,
            maxPrice: conversation.maxPrice,
            email: conversation.email,
            preferences: conversation.preferences ? JSON.parse(conversation.preferences) : null,
            isComplete: conversation.isComplete,
            needsConfirmation: false,
        };

        const { response, state } = await processChat(messages, currentState, apiKey);

        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                role: 'assistant',
                content: response,
            },
        });

        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                itemType: state.itemType,
                zipcode: state.zipcode,
                radius: state.radius,
                maxPrice: state.maxPrice,
                email: state.email,
                preferences: state.preferences ? JSON.stringify(state.preferences) : null,
                isComplete: state.isComplete,
            },
        });

        let searchId = null;
        if (state.isComplete && state.itemType && state.zipcode && state.email) {
            // Check alert limit per email (max 10 active searches)
            const existingSearches = await prisma.search.count({
                where: { user: { email: state.email }, isActive: true },
            });

            if (existingSearches >= 10) {
                return NextResponse.json({
                    conversationId: conversation.id,
                    message: "You've reached the maximum of 10 active alerts. Please delete some alerts from your dashboard before creating new ones.",
                    state,
                    searchId: null,
                });
            }

            let user = await prisma.user.findUnique({ where: { email: state.email } });
            if (!user) {
                user = await prisma.user.create({ data: { email: state.email } });
            }

            const search = await prisma.search.create({
                data: {
                    userId: user.id,
                    query: state.itemType,
                    zipcode: state.zipcode,
                    radius: state.radius || 25,
                    maxPrice: state.maxPrice,
                    preferences: state.preferences ? JSON.stringify(state.preferences) : null,
                },
            });

            searchId = search.id;

            await prisma.conversation.update({
                where: { id: conversation.id },
                data: { userId: user.id, searchId: search.id },
            });
        }

        return NextResponse.json({
            conversationId: conversation.id,
            message: response,
            state: {
                itemType: state.itemType,
                zipcode: state.zipcode,
                radius: state.radius,
                maxPrice: state.maxPrice,
                email: state.email,
                preferences: state.preferences,
                needsConfirmation: state.needsConfirmation,
                isComplete: state.isComplete,
            },
            searchId,
        }, {
            headers: {
                'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            }
        });
    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
    }
}

// GET /api/chat - Start a new conversation
export async function GET(request: NextRequest) {
    const clientIP = getClientIP(request);

    // Rate limit new conversation starts
    const rateLimit = checkRateLimit(`chat-start:${clientIP}`, RATE_LIMITS.createAlert);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: `Too many requests. Try again in ${rateLimit.resetIn} seconds.` },
            { status: 429 }
        );
    }

    const conversation = await prisma.conversation.create({ data: {} });
    const initialMessage = getInitialMessage();

    await prisma.message.create({
        data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: initialMessage,
        },
    });

    return NextResponse.json({
        conversationId: conversation.id,
        message: initialMessage,
        state: {
            itemType: null,
            zipcode: null,
            radius: null,
            maxPrice: null,
            email: null,
            preferences: null,
            needsConfirmation: false,
            isComplete: false,
        },
    });
}
