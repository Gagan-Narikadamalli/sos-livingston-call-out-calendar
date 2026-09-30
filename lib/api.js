import { NextResponse } from 'next/server';

export function withApiErrors(handler) {
  return async function (...args) {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Send valid request details.' }, { status: 400 });
      }
      console.error('Calendar API request failed:', error);
      return NextResponse.json({ error: 'Unable to complete the request. Please try again.' }, { status: 500 });
    }
  };
}
