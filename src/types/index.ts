export interface User {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Search {
    id: string;
    userId: string;
    query: string;
    zipcode: string;
    maxPrice: number | null;
    minPrice: number | null;
    isActive: boolean;
    lastChecked: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Listing {
    id: string;
    searchId: string;
    externalId: string;
    title: string;
    price: number | null;
    url: string;
    description: string | null;
    imageUrl: string | null;
    location: string | null;
    postedAt: Date | null;
    dealScore: number | null;
    dealReason: string | null;
    isGoodDeal: boolean;
    alertSent: boolean;
    createdAt: Date;
}

export interface SearchWithListings extends Search {
    listings: Listing[];
    user: User;
}

export interface CreateSearchInput {
    email: string;
    query: string;
    zipcode: string;
    maxPrice?: number;
    minPrice?: number;
}
