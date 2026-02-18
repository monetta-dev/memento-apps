import { createRouteHandlerClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { code } = await request.json();

        if (!code) {
            return NextResponse.json({ error: 'Organization code is required' }, { status: 400 });
        }

        // 1. Authenticate the user
        // We use the standard route handler client to get the verified user from the session
        const supabaseUser = createRouteHandlerClient({ cookies });
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Initialize Admin Client to bypass RLS
        // We need this because the user might not have permission to read organizations table
        // until they are a member.
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 3. Find Organization by Code
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('code', code)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found available' }, { status: 404 });
        }

        // 4. Update Profile
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ organization_id: org.id })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error updating profile:', updateError);
            return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            organization: org
        });

    } catch (error) {
        console.error('Join organization error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
