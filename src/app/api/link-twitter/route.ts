import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const twitterUsername = (session as any).twitterUsername?.toLowerCase()
    if (!twitterUsername) {
      return NextResponse.json({ error: 'Twitter username not found in session' }, { status: 400 })
    }
    
    // Get wallet from body
    const body = await request.json()
    const wallet = body.wallet?.toLowerCase()
    
    if (!wallet || !/^0x[a-f0-9]{40}$/i.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }
    
    // Find agent linked to this Twitter account
    const twitterLink = await prisma.twitterAgentLink.findUnique({
      where: { twitterUsername }
    })
    
    if (!twitterLink) {
      return NextResponse.json({ 
        error: 'No agent found for this Twitter account',
        hint: 'Your Twitter account must be linked to a Moltbook agent first'
      }, { status: 404 })
    }
    
    const agent = twitterLink.agentName
    
    // Check if wallet already linked to this agent
    const existing = await prisma.walletLink.findFirst({
      where: { agent, wallet }
    })
    
    if (existing) {
      return NextResponse.json({ 
        success: true,
        message: 'Wallet already linked',
        agent
      })
    }
    
    // Create wallet link
    await prisma.walletLink.create({
      data: {
        agent,
        wallet,
        source: 'twitter',
        createdAt: new Date()
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Wallet linked successfully',
      agent,
      wallet
    })
    
  } catch (error) {
    console.error('Link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Check link status for current Twitter user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ authenticated: false })
    }
    
    const twitterUsername = (session as any).twitterUsername?.toLowerCase()
    if (!twitterUsername) {
      return NextResponse.json({ authenticated: true, twitterUsername: null })
    }
    
    // Find agent
    const twitterLink = await prisma.twitterAgentLink.findUnique({
      where: { twitterUsername }
    })
    
    if (!twitterLink) {
      return NextResponse.json({
        authenticated: true,
        twitterUsername,
        agent: null
      })
    }
    
    // Find wallet links for this agent
    const walletLinks = await prisma.walletLink.findMany({
      where: { agent: twitterLink.agentName }
    })
    
    return NextResponse.json({
      authenticated: true,
      twitterUsername,
      agent: twitterLink.agentName,
      wallets: walletLinks.map(w => w.wallet)
    })
    
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
