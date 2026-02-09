import { NextResponse } from 'next/server';

const BOUNTY_API = 'http://localhost:3457';

export async function GET() {
  try {
    const res = await fetch(`${BOUNTY_API}/api/bounties`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch bounties' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    let endpoint = '';
    if (action === 'start') {
      endpoint = '/api/bounty/claim/start';
    } else if (action === 'verify') {
      endpoint = '/api/bounty/claim/verify';
    } else if (action === 'status') {
      endpoint = `/api/bounty/claim/status/${params.claimCode}`;
      const res = await fetch(`${BOUNTY_API}${endpoint}`);
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const res = await fetch(`${BOUNTY_API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
