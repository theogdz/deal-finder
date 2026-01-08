'use client';

import { useState } from 'react';

interface Search {
    id: string;
    query: string;
    zipcode: string;
    maxPrice: number | null;
    isActive: boolean;
    lastChecked: string | null;
    listings: {
        id: string;
        isGoodDeal: boolean;
    }[];
}

interface SearchCardProps {
    search: Search;
    onToggle: (id: string, isActive: boolean) => void;
    onDelete: (id: string) => void;
    onScan: (id: string) => Promise<void>;
    onClick: (id: string) => void;
}

function formatPrice(priceInCents: number | null): string {
    if (priceInCents === null) return 'No limit';
    return `$${(priceInCents / 100).toLocaleString()}`;
}

export default function SearchCard({ search, onToggle, onDelete, onScan, onClick }: SearchCardProps) {
    const [isScanning, setIsScanning] = useState(false);
    const goodDeals = search.listings.filter(l => l.isGoodDeal).length;

    const handleScan = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsScanning(true);
        try {
            await onScan(search.id);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div
            onClick={() => onClick(search.id)}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 transition-all hover:bg-gray-800/70 hover:border-gray-600 cursor-pointer"
        >
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        🔍 {search.query}
                        {!search.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded-full">
                                Paused
                            </span>
                        )}
                    </h3>
                    <p className="mt-1 text-gray-400">
                        📍 {search.zipcode} · Max: {formatPrice(search.maxPrice)}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleScan}
                        disabled={isScanning || !search.isActive}
                        className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50"
                        title="Scan now"
                    >
                        {isScanning ? (
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(search.id, !search.isActive);
                        }}
                        className={`p-2 rounded-lg transition-all ${search.isActive
                                ? 'text-emerald-400 hover:bg-emerald-400/10'
                                : 'text-gray-500 hover:bg-gray-700'
                            }`}
                        title={search.isActive ? 'Pause alerts' : 'Resume alerts'}
                    >
                        {search.isActive ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(search.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Delete search"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="text-gray-400">
                        {search.listings.length} listings found
                    </span>
                    {goodDeals > 0 && (
                        <span className="text-emerald-400 font-medium">
                            🔥 {goodDeals} good deal{goodDeals > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {search.lastChecked && (
                    <span className="text-gray-500">
                        Last checked: {new Date(search.lastChecked).toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
}
