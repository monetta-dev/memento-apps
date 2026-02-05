import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'memento-1on1',
    version: process.env.npm_package_version || 'unknown',
  });
}