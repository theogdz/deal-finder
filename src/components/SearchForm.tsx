'use client';

import { useState } from 'react';

interface SearchFormProps {
    onSuccess?: (searchId: string) => void;
}

const BIKE_TYPES = [
    { id: 'road', label: 'Road' },
    { id: 'gravel', label: 'Gravel' },
    { id: 'mountain', label: 'Mountain' },
    { id: 'hybrid', label: 'Hybrid' },
    { id: 'commuter', label: 'Commuter' },
    { id: 'fixed', label: 'Fixed Gear' },
];

const HEIGHT_TO_FRAME: Record<string, string> = {
    '60': '48-50cm / XS',
    '62': '50-52cm / S',
    '64': '52-54cm / S',
    '66': '54-56cm / M',
    '68': '56-58cm / M-L',
    '70': '58-60cm / L',
    '72': '60-62cm / L-XL',
    '74': '62-64cm / XL',
};

export default function SearchForm({ onSuccess }: SearchFormProps) {
    const [email, setEmail] = useState('');
    const [query, setQuery] = useState('');
    const [zipcode, setZipcode] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [bikeType, setBikeType] = useState('road');
    const [heightFeet, setHeightFeet] = useState('5');
    const [heightInches, setHeightInches] = useState('6');
    const [condition, setCondition] = useState('any');

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const totalHeightInches = parseInt(heightFeet) * 12 + parseInt(heightInches);
    const nearestHeight = Object.keys(HEIGHT_TO_FRAME)
        .map(Number)
        .reduce((prev, curr) =>
            Math.abs(curr - totalHeightInches) < Math.abs(prev - totalHeightInches) ? curr : prev
        );
    const recommendedFrame = HEIGHT_TO_FRAME[nearestHeight.toString()];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/searches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    query: `${bikeType} ${query}`.trim() || bikeType,
                    zipcode,
                    maxPrice: maxPrice ? parseInt(maxPrice) * 100 : null,
                    bikeType,
                    frameSize: recommendedFrame,
                    condition: condition === 'any' ? null : condition,
                    height: totalHeightInches,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create alert');
            }

            setSuccess(true);
            onSuccess?.(data.id);

            // Reset form
            setQuery('');
            setMaxPrice('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="form-card">
            <h2 className="form-title">Find your next ride</h2>
            <p className="form-description">
                We&apos;ll monitor Craigslist and alert you when we find bikes that match your preferences.
            </p>

            {success && (
                <div className="alert alert-success">
                    You&apos;re all set. We&apos;ll email you when we find something good.
                </div>
            )}

            {error && (
                <div className="alert alert-error">{error}</div>
            )}

            {/* Email */}
            <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="form-input"
                />
            </div>

            {/* Bike Type */}
            <div className="preference-section">
                <label className="form-label">What are you looking for?</label>
                <div className="preference-chips">
                    {BIKE_TYPES.map((type) => (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => setBikeType(type.id)}
                            className={`preference-chip ${bikeType === type.id ? 'active' : ''}`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Additional keywords */}
            <div className="form-group">
                <label htmlFor="query" className="form-label">Brand or keywords (optional)</label>
                <input
                    id="query"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., Specialized, carbon, disc brakes"
                    className="form-input"
                />
            </div>

            {/* Height for frame sizing */}
            <div className="form-group">
                <label className="form-label">Your height (for frame sizing)</label>
                <div className="form-row">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                            value={heightFeet}
                            onChange={(e) => setHeightFeet(e.target.value)}
                            className="form-select"
                            style={{ width: '80px' }}
                        >
                            {[4, 5, 6, 7].map((ft) => (
                                <option key={ft} value={ft}>{ft} ft</option>
                            ))}
                        </select>
                        <select
                            value={heightInches}
                            onChange={(e) => setHeightInches(e.target.value)}
                            className="form-select"
                            style={{ width: '80px' }}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i}>{i} in</option>
                            ))}
                        </select>
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-elevated)',
                        padding: '8px 12px',
                        borderRadius: '8px'
                    }}>
                        → {recommendedFrame}
                    </div>
                </div>
            </div>

            {/* Location and Budget */}
            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="zipcode" className="form-label">Zip code</label>
                    <input
                        id="zipcode"
                        type="text"
                        value={zipcode}
                        onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        required
                        placeholder="90210"
                        pattern="\d{5}"
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="maxPrice" className="form-label">Max budget</label>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }}>$</span>
                        <input
                            id="maxPrice"
                            type="number"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                            placeholder="1500"
                            min="0"
                            className="form-input"
                            style={{ paddingLeft: '28px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Condition */}
            <div className="preference-section">
                <label className="form-label">Condition</label>
                <div className="preference-chips">
                    {[
                        { id: 'any', label: 'Any' },
                        { id: 'excellent', label: 'Excellent' },
                        { id: 'good', label: 'Good' },
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setCondition(opt.id)}
                            className={`preference-chip ${condition === opt.id ? 'active' : ''}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={loading}
                className="btn-primary"
            >
                {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span className="spinner" /> Setting up...
                    </span>
                ) : (
                    'Start monitoring'
                )}
            </button>
        </form>
    );
}
