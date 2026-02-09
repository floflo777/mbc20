'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface DataPoint {
  time: string
  timestamp: number
  supply: string
  minted: string
}

interface MintChartProps {
  tick: string
  maxSupply: string
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toLocaleString()
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

export function MintChart({ tick, maxSupply }: MintChartProps) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tokens/${tick}/mint-history`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tick])

  if (loading) {
    return (
      <div className="h-72 flex items-center justify-center text-text-secondary">
        Loading chart...
      </div>
    )
  }

  if (data.length < 2) {
    return (
      <div className="h-72 flex items-center justify-center text-text-secondary">
        Not enough data for chart yet.
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    supplyNum: parseInt(d.supply, 10),
    mintedNum: parseInt(d.minted, 10),
  }))

  const max = parseInt(maxSupply, 10)
  const currentSupply = chartData[chartData.length - 1].supplyNum
  const progress = (currentSupply / max) * 100
  
  // Calculate mint rate (last 24h vs previous 24h)
  const now = chartData[chartData.length - 1].timestamp
  const h24Ago = now - 24 * 60 * 60 * 1000
  const h48Ago = now - 48 * 60 * 60 * 1000
  
  const supplyAt24h = chartData.find(d => d.timestamp >= h24Ago)?.supplyNum || chartData[0].supplyNum
  const supplyAt48h = chartData.find(d => d.timestamp >= h48Ago)?.supplyNum || chartData[0].supplyNum
  
  const last24hMinted = currentSupply - supplyAt24h
  const prev24hMinted = supplyAt24h - supplyAt48h
  
  // Hourly rate
  const totalHours = (now - chartData[0].timestamp) / (1000 * 60 * 60)
  const avgHourlyRate = currentSupply / totalHours
  const remaining = max - currentSupply
  const hoursToMax = remaining / avgHourlyRate

  // Trend
  const trendUp = last24hMinted > prev24hMinted
  const trendPercent = prev24hMinted > 0 
    ? Math.round(((last24hMinted - prev24hMinted) / prev24hMinted) * 100) 
    : 0

  return (
    <div className="space-y-4">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatDate}
              stroke="#a1a1a1"
              tick={{ fill: '#a1a1a1', fontSize: 12 }}
              axisLine={{ stroke: '#262626' }}
              tickLine={{ stroke: '#262626' }}
            />
            <YAxis
              domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, max * 0.1)]}
              tickFormatter={formatNumber}
              stroke="#a1a1a1"
              tick={{ fill: '#a1a1a1', fontSize: 12 }}
              axisLine={{ stroke: '#262626' }}
              tickLine={{ stroke: '#262626' }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#141414',
                border: '1px solid #262626',
                borderRadius: '8px',
                color: '#fafafa',
              }}
              labelFormatter={(value) => formatDateTime(value as number)}
              formatter={(value: number) => [formatNumber(value), 'Supply']}
            />
            <Area
              type="monotone"
              dataKey="supplyNum"
              stroke="#dc2626"
              strokeWidth={2}
              fill="url(#supplyGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center text-sm">
        <div className="bg-surface rounded-lg p-3">
          <div className="text-text-secondary">Last 24h</div>
          <div className="font-mono text-lg text-success">+{formatNumber(last24hMinted)}</div>
          <div className={`text-xs ${trendUp ? 'text-success' : 'text-accent'}`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trendPercent)}% vs prev
          </div>
        </div>
        <div className="bg-surface rounded-lg p-3">
          <div className="text-text-secondary">Progress</div>
          <div className="font-mono text-lg">{progress.toFixed(2)}%</div>
          <div className="text-xs text-text-secondary">of {formatNumber(max)}</div>
        </div>
        <div className="bg-surface rounded-lg p-3">
          <div className="text-text-secondary">ETA to Max</div>
          <div className="font-mono text-lg">{formatDuration(hoursToMax)}</div>
          <div className="text-xs text-text-secondary">at current rate</div>
        </div>
      </div>
    </div>
  )
}
