import { NextResponse } from 'next/server';
import { adminAuth } from '../../../../../lib/firebaseAdmin';


export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    try {
      await adminAuth.getUserByEmail(email);
      // Found -> not available
      return NextResponse.json({ available: false });
    } catch (e: any) {
      // If no user, Firebase throws auth/user-not-found
      if (e?.code === 'auth/user-not-found') {
        return NextResponse.json({ available: true });
      }
      console.error('check-email error:', e);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
