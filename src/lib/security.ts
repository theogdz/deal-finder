/**
 * Simple in-memory rate limiter for API endpoints
 * In production, use Redis or a proper rate limiting service
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    maxRequests: number;  // Max requests allowed
    windowMs: number;     // Time window in milliseconds
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;  // Seconds until reset
}

/**
 * Check if a request is rate limited
 * @param identifier - Unique identifier (IP, email, etc.)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    if (!entry || entry.resetTime < now) {
        // First request or window expired
        rateLimitStore.set(identifier, {
            count: 1,
            resetTime: now + config.windowMs,
        });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetIn: Math.ceil(config.windowMs / 1000),
        };
    }

    if (entry.count >= config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: Math.ceil((entry.resetTime - now) / 1000),
        };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetIn: Math.ceil((entry.resetTime - now) / 1000),
    };
}

// Preset configurations for different endpoints
export const RATE_LIMITS = {
    // Chat API: 30 messages per minute per IP
    chat: { maxRequests: 30, windowMs: 60 * 1000 },

    // Scan API: 5 scans per hour per user
    scan: { maxRequests: 5, windowMs: 60 * 60 * 1000 },

    // Alert creation: 10 per hour per IP
    createAlert: { maxRequests: 10, windowMs: 60 * 60 * 1000 },

    // Search listing: 60 per minute per IP
    search: { maxRequests: 60, windowMs: 60 * 1000 },
};

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }
    return 'unknown';
}

/**
 * Simple input sanitization
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
        .trim()
        .slice(0, 1000) // Max length
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>\"'`;]/g, ''); // Remove dangerous characters
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate zip code format (US)
 */
export function isValidZipcode(zipcode: string): boolean {
    return /^\d{5}(-\d{4})?$/.test(zipcode);
}

/**
 * Check for suspicious patterns (basic bot detection)
 */
export function isSuspiciousRequest(request: Request): boolean {
    const userAgent = request.headers.get('user-agent') || '';

    // Block empty or suspicious user agents
    if (!userAgent || userAgent.length < 10) {
        return true;
    }

    // Block common bot patterns
    const botPatterns = [
        /bot/i,
        /spider/i,
        /crawler/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python-requests/i,
    ];

    // Allow Googlebot, etc. but block generic bots
    if (botPatterns.some(p => p.test(userAgent)) &&
        !userAgent.includes('Googlebot')) {
        return true;
    }

    return false;
}
