import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// For client components
export const createClientComponentClient = () => {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

/**
 * Get OAuth redirect URL for authentication callbacks
 * Uses NEXT_PUBLIC_SITE_URL environment variable if available,
 * otherwise falls back to window.location.origin (client-side only)
 * 
 * @returns Full redirect URL including /auth/callback path
 * @throws Error in server-side rendering when NEXT_PUBLIC_SITE_URL is not set
 */
export const getOAuthRedirectUrl = (): string => {
    // Use environment variable if available (works in both build and runtime)
    if (process.env.NEXT_PUBLIC_SITE_URL) {
        return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
    }

    // Fallback to window.location.origin only in client-side
    if (typeof window !== 'undefined') {
        // Log warning in development about missing environment variable
        if (process.env.NODE_ENV === 'development') {
            console.warn(
                'NEXT_PUBLIC_SITE_URL environment variable is not set. ' +
                'Using window.location.origin as fallback. ' +
                'This may cause issues in production builds.'
            );
        }
        return `${window.location.origin}/auth/callback`;
    }

    // Server-side rendering without env var - throw error for clarity
    throw new Error(
        'NEXT_PUBLIC_SITE_URL environment variable is required for server-side OAuth redirects. ' +
        'Please set it in your environment variables.'
    );
};
