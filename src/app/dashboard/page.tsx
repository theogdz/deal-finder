'use client';

import { useState, useEffect, useCallback } from 'react';
import SearchForm from '@/components/SearchForm';
import SearchCard from '@/components/SearchCard';
import ListingCard from '@/components/ListingCard';
import Link from 'next/link';

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

interface Search {
    id: string;
    query: string;
    zipcode: string;
    maxPrice: number | null;
    isActive: boolean;
    lastChecked: string | null;
    listings: Listing[];
}

export default function DashboardPage() {
    const [email, setEmail] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [searches, setSearches] = useState<Search[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSearch, setSelectedSearch] = useState<Search | null>(null);
    const [showNewSearch, setShowNewSearch] = useState(false);

    const fetchSearches = useCallback(async () => {
        if (!email) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/searches?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            setSearches(data.searches || []);
        } catch (error) {
            console.error('Error fetching searches:', error);
        } finally {
            setIsLoading(false);
        }
    }, [email]);

    useEffect(() => {
        // Check for saved email in localStorage
        const savedEmail = localStorage.getItem('dealfinder_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setIsLoggedIn(true);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn && email) {
            fetchSearches();
        }
    }, [isLoggedIn, email, fetchSearches]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            localStorage.setItem('dealfinder_email', email);
            setIsLoggedIn(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('dealfinder_email');
        setEmail('');
        setSearches([]);
        setIsLoggedIn(false);
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        try {
            await fetch(`/api/searches/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            setSearches(searches.map(s => s.id === id ? { ...s, isActive } : s));
        } catch (error) {
            console.error('Error toggling search:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this search?')) return;
        try {
            await fetch(`/api/searches/${id}`, { method: 'DELETE' });
            setSearches(searches.filter(s => s.id !== id));
            if (selectedSearch?.id === id) setSelectedSearch(null);
        } catch (error) {
            console.error('Error deleting search:', error);
        }
    };

    const handleScan = async (id: string) => {
        try {
            const response = await fetch(`/api/searches/${id}`, { method: 'POST' });
            const result = await response.json();
            console.log('Scan result:', result);
            await fetchSearches();
        } catch (error) {
            console.error('Error scanning:', error);
        }
    };

    const handleSearchClick = (id: string) => {
        const search = searches.find(s => s.id === id);
        if (search) setSelectedSearch(search);
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center px-4">
                <div className="max-w-md w-full">
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-6">
                            ← Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold text-white">Access Dashboard</h1>
                        <p className="text-gray-400 mt-2">Enter your email to view your searches</p>
                    </div>

                    <form onSubmit={handleLogin} className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-4"
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                        >
                            View My Searches
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-white">
                        🎯 DealFinder
                    </Link>

                    <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-sm hidden sm:block">{email}</span>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Your Deal Alerts</h1>
                        <p className="text-gray-400 mt-1">
                            {searches.length} active search{searches.length !== 1 ? 'es' : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => setShowNewSearch(!showNewSearch)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                    >
                        <span className="text-lg">+</span>
                        New Search
                    </button>
                </div>

                {/* New Search Form */}
                {showNewSearch && (
                    <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Create New Alert</h2>
                        <SearchForm onSuccess={() => {
                            setShowNewSearch(false);
                            fetchSearches();
                        }} />
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Searches List */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span>📋</span> Your Searches
                        </h2>

                        {isLoading ? (
                            <div className="text-center py-12 text-gray-400">
                                Loading...
                            </div>
                        ) : searches.length === 0 ? (
                            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-8 text-center">
                                <p className="text-gray-400 mb-4">You don&apos;t have any searches yet.</p>
                                <button
                                    onClick={() => setShowNewSearch(true)}
                                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                                >
                                    Create your first search →
                                </button>
                            </div>
                        ) : (
                            searches.map((search) => (
                                <SearchCard
                                    key={search.id}
                                    search={search}
                                    onToggle={handleToggle}
                                    onDelete={handleDelete}
                                    onScan={handleScan}
                                    onClick={handleSearchClick}
                                />
                            ))
                        )}
                    </div>

                    {/* Listings View */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span>📦</span>
                            {selectedSearch ? `Listings for "${selectedSearch.query}"` : 'Select a Search'}
                        </h2>

                        {selectedSearch ? (
                            <div className="space-y-4">
                                {selectedSearch.listings.length === 0 ? (
                                    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-8 text-center">
                                        <p className="text-gray-400">No listings found yet.</p>
                                        <p className="text-gray-500 text-sm mt-1">Click the refresh button to scan now.</p>
                                    </div>
                                ) : (
                                    selectedSearch.listings.map((listing) => (
                                        <ListingCard key={listing.id} listing={listing} />
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-8 text-center">
                                <p className="text-gray-400">Click on a search to view its listings</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
