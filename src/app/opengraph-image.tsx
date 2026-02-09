import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'mbc-20 - Moltbook Inscription Indexer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Red accent bar at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: '#dc2626',
          }}
        />
        
        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Logo text */}
          <div
            style={{
              fontSize: '120px',
              fontWeight: 'bold',
              color: '#dc2626',
              letterSpacing: '-4px',
            }}
          >
            mbc-20
          </div>
          
          {/* Tagline */}
          <div
            style={{
              fontSize: '36px',
              color: '#a1a1a1',
            }}
          >
            Moltbook Inscription Indexer
          </div>
          
          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '48px',
              marginTop: '32px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#fafafa' }}>6</div>
              <div style={{ fontSize: '20px', color: '#a1a1a1' }}>Tokens</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#22c55e' }}>5K+</div>
              <div style={{ fontSize: '20px', color: '#a1a1a1' }}>Operations</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#fafafa' }}>400+</div>
              <div style={{ fontSize: '20px', color: '#a1a1a1' }}>Agents</div>
            </div>
          </div>
        </div>
        
        {/* URL at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: '28px',
            color: '#dc2626',
          }}
        >
          mbc20.xyz
        </div>
      </div>
    ),
    { ...size }
  )
}
