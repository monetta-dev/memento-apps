'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient, getOAuthRedirectUrl } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClientComponentClient();
    const router = useRouter();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state change:', event);
            setUser(session?.user ?? null);
            setIsLoading(false);
            // Removed automatic redirect here because it might conflict with page-level protection 
            // or redirect loops if not handled carefully. DashboardLayout handles protection.
            if (event === 'SIGNED_OUT') {
                router.push('/login');
            }
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, router]);

    const signIn = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            return { error };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const signUp = async (email: string, password: string, fullName: string) => {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (authError) {
                return { error: authError };
            }

            if (authData?.user) {
                // Create profile logic could go here or trigger on DB
                // For now adhering to 1on1 logic which creates profile client-side if needed, 
                // OR rely on trigger. 
                // 1on1 code checked: creates profile manually if needed.
                const { error: profileError } = await supabase.from('profiles').insert({
                    id: authData.user.id,
                    email: authData.user.email,
                    full_name: fullName,
                    // role: 'manager', // Analytics might have different roles, assume default or set later
                });

                if (profileError) {
                    console.error('Failed to create profile:', profileError);
                    // return { error: profileError }; // Optional: fail hard or soft?
                }
            }

            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const signInWithGoogle = async () => {
        const redirectUrl = getOAuthRedirectUrl();
        console.log('Google OAuth redirect URL:', redirectUrl);

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    scopes: 'email profile https://www.googleapis.com/auth/calendar openid',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent'
                    },
                    skipBrowserRedirect: false
                }
            });

            if (error) {
                console.error('Google OAuth error:', error);
                alert(`Googleログインエラー: ${error.message}`);
            } else if (!data?.url) {
                console.error('Google OAuth no URL returned');
                alert('Googleログインのリダイレクトに失敗しました。設定を確認してください。');
            }
        } catch (err: unknown) {
            console.error('Google OAuth exception:', err);
            const message = err instanceof Error ? err.message : String(err);
            alert(`Googleログイン例外: ${message}`);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, signInWithGoogle }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
