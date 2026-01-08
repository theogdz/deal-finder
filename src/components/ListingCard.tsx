'use client';

interface Listing {
    id: string;
    title: string;
    price: number | null;
    url: string;
    dealScore: number | null;
    dealReason: string | null;
    isGoodDeal: boolean;
    imageUrl: string | null;
    createdAt: string;
}

interface ListingCardProps {
    listing: Listing;
}

function formatPrice(priceInCents: number | null): string {
    if (priceInCents === null) return 'Price not listed';
    return `$${(priceInCents / 100).toLocaleString()}`;
}

function getScoreColor(score: number | null): string {
    if (score === null) return 'bg-gray-500';
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    if (score >= 30) return 'bg-orange-500';
    return 'bg-red-500';
}

export default function ListingCard({ listing }: ListingCardProps) {
    return (
        <div className={`
      bg-gray-800/50 border rounded-xl p-5 transition-all hover:bg-gray-800/70
      ${listing.isGoodDeal ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-gray-700'}
    `}>
            <div className="flex gap-4">
                {listing.imageUrl && (
                    <div className="flex-shrink-0">
                        <img
                            src={listing.imageUrl}
                            alt=""
                            className="w-24 h-24 object-cover rounded-lg bg-gray-700"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium text-white truncate">
                            <a
                                href={listing.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-emerald-400 transition-colors"
                            >
                                {listing.title}
                            </a>
                        </h3>

                        {listing.isGoodDeal && (
                            <span className="flex-shrink-0 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
                                🔥 Good Deal
                            </span>
                        )}
                    </div>

                    <p className="mt-1 text-2xl font-bold text-emerald-400">
                        {formatPrice(listing.price)}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                        {listing.dealScore !== null && (
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getScoreColor(listing.dealScore)}`} />
                                <span className="text-sm text-gray-400">
                                    Score: {listing.dealScore}/100
                                </span>
                            </div>
                        )}
                    </div>

                    {listing.dealReason && (
                        <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                            {listing.dealReason}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    Found {new Date(listing.createdAt).toLocaleDateString()}
                </span>

                <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                    View on Craigslist →
                </a>
            </div>
        </div>
    );
}
