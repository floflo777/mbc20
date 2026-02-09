import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Store pending verifications (in production, use Redis or DB)
const pendingVerifications = new Map<string, { code: string; agent: string; expires: number }>()

// GET: Check if Twitter username has an agent + generate verification code
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username')?.toLowerCase().replace('@', '')
  
  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 })
  }
  
  // Find agent linked to this Twitter
  const link = await prisma.twitterAgentLink.findUnique({
    where: { twitterUsername: username }
  })
  
  if (!link) {
    return NextResponse.json({ 
      found: false,
      error: 'No agent found for this Twitter account'
    })
  }
  
  // Generate verification code
  const code = 'MBC20-' + crypto.randomBytes(4).toString('hex').toUpperCase()
  
  // Store pending verification (expires in 10 minutes)
  pendingVerifications.set(username, {
    code,
    agent: link.agentName,
    expires: Date.now() + 10 * 60 * 1000
  })
  
  return NextResponse.json({
    found: true,
    agent: link.agentName,
    code,
    tweetText: `Linking wallet to ${link.agentName} on @mbc20xyz ${code}`
  })
}

// POST: Verify tweet and link wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, wallet } = body
    
    const normalizedUsername = username?.toLowerCase().replace('@', '')
    const normalizedWallet = wallet?.toLowerCase()
    
    if (!normalizedUsername || !normalizedWallet) {
      return NextResponse.json({ error: 'Username and wallet required' }, { status: 400 })
    }
    
    if (!/^0x[a-f0-9]{40}$/i.test(normalizedWallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }
    
    // Get pending verification
    const pending = pendingVerifications.get(normalizedUsername)
    if (!pending || pending.expires < Date.now()) {
      return NextResponse.json({ error: 'Verification expired. Please generate a new code.' }, { status: 400 })
    }
    
    // Fetch recent tweets from user's timeline
    // Using Twitter's public timeline (no auth required for public profiles)
    const twitterUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${normalizedUsername}`
    
    let verified = false
    try {
      // Try nitter or other public method
      const response = await fetch(`https://api.fxtwitter.com/${normalizedUsername}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      
      if (response.ok) {
        const data = await response.json()
        const tweets = data.tweets || []
        
        // Check if any recent tweet contains our code
        for (const tweet of tweets.slice(0, 10)) {
          if (tweet.text?.includes(pending.code)) {
            verified = true
            break
          }
        }
      }
    } catch (e) {
      console.error('Twitter fetch error:', e)
    }
    
    // For testing/development: also accept if code is in request
    if (body.code === pending.code) {
      verified = true
    }
    
    if (!verified) {
      return NextResponse.json({ 
        error: 'Tweet not found. Make sure you tweeted the exact code and try again.',
        code: pending.code 
      }, { status: 400 })
    }
    
    // Link wallet
    const agent = pending.agent
    
    // Check if already linked
    const existing = await prisma.walletLink.findFirst({
      where: { agent, wallet: normalizedWallet }
    })
    
    if (!existing) {
      await prisma.walletLink.create({
        data: {
          agent,
          wallet: normalizedWallet,
          source: 'twitter-verify',
          createdAt: new Date()
        }
      })
    }
    
    // Clear pending verification
    pendingVerifications.delete(normalizedUsername)
    
    return NextResponse.json({
      success: true,
      agent,
      wallet: normalizedWallet
    })
    
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
