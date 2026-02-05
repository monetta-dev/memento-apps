import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // 開発環境用のCookie設定を調整
          cookiesToSet.forEach(({ name, value, options }) => {
            const isLocalhost = request.nextUrl.hostname === 'localhost';
            const cookieOptions = isLocalhost ? {
              ...options,
              sameSite: 'lax',
              secure: false,
              domain: 'localhost',
            } : options;
            
            supabaseResponse.cookies.set(name, value, cookieOptions);
          });
        },
      },
    }
  );

  // Refresh session if expired
  try {
    await supabase.auth.getUser();
  } catch (error) {
    console.error('❌ supabase.auth.getUser() エラー:', error);
  }

  // Define protected routes
  const protectedRoutes = ['/', '/session', '/crm', '/settings'];
  const isProtectedRoute = protectedRoutes.some(route => {
    if (route === '/') {
      return request.nextUrl.pathname === '/';
    }
    // Exclude /session/*/join from protected routes
    if (route === '/session' && request.nextUrl.pathname.includes('/join')) {
      return false;
    }
    return request.nextUrl.pathname.startsWith(route);
  });

  // Auth routes
  const authRoutes = ['/login', '/signup', '/forgot-password'];
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

  const result = await supabase.auth.getUser();
  const user = result.data.user;
  const userError = result.error;
  
  if (userError) {
    console.error('Middleware getUser error:', userError.message);
  }

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth routes to home
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};