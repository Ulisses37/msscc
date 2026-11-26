import { NextResponse } from 'next/server';

import { getDeepLUsage } from '@/utils/deeplServer';

export const dynamic = 'force-dynamic';

/** Returns normalized DeepL usage while keeping provider credentials on the server. */
export async function GET() {
  try {
    return NextResponse.json(await getDeepLUsage());
  } catch (error) {
    console.error('Unable to retrieve DeepL usage.', error);
    return NextResponse.json({ error: 'DeepL usage is unavailable' }, { status: 502 });
  }
}