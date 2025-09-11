import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Admin user IDs or emails that can access UCO test dashboard
const ADMIN_USERS = [
  'steve@example.com',  // Replace with actual admin emails
  'admin@intellipedia.ai'
];

export function middleware(request: NextRequest) {
  // Check if user is authenticated and is admin
  const authCookie = request.cookies.get('auth');
  
  if (!authCookie) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login?redirect=/uco-test', request.url));
  }
  
  try {
    // Decode auth token (simplified - use proper JWT validation in production)
    const authData = JSON.parse(atob(authCookie.value));
    
    if (!ADMIN_USERS.includes(authData.email)) {
      // Return 403 Forbidden if not admin
      return new NextResponse('Admin access required', { status: 403 });
    }
    
    // Allow access for admins
    return NextResponse.next();
  } catch (error) {
    // Invalid auth token
    return NextResponse.redirect(new URL('/login?redirect=/uco-test', request.url));
  }
}

export const config = {
  matcher: '/uco-test/:path*',
};