// mbc-20 protocol types and validation

export interface DeployOp {
  p: 'mbc-20'
  op: 'deploy'
  tick: string
  max: string
  lim: string
}

export interface MintOp {
  p: 'mbc-20'
  op: 'mint'
  tick: string
  amt: string
}

export interface TransferOp {
  p: 'mbc-20'
  op: 'transfer'
  tick: string
  amt: string
  to: string
}

export interface BurnOp {
  p: 'mbc-20'
  op: 'burn'
  tick: string
  amt: string
  address?: string
}

export interface LinkOp {
  p: 'mbc-20'
  op: 'link'
  wallet: string
}

export type Mbc20Op = DeployOp | MintOp | TransferOp | BurnOp | LinkOp

export function parseMbc20(content: string): Mbc20Op | null {
  const ops = parseMbc20All(content)
  return ops.length > 0 ? ops[0] : null
}

export function parseMbc20All(content: string): Mbc20Op[] {
  // Find ALL JSON objects with mbc-20, but only keep ONE per (tick, op) to prevent
  // multi-mint abuse (stacking multiple identical JSONs in a single post)
  const jsonMatches = content.matchAll(/\{[^{}]*"p"\s*:\s*"mbc-20"[^{}]*\}/gi)
  const ops: Mbc20Op[] = []
  const seen = new Set<string>()

  for (const match of jsonMatches) {
    try {
      const parsed = JSON.parse(match[0])

      // Validate protocol
      if (parsed.p?.toLowerCase() !== 'mbc-20') continue

      const op = parsed.op?.toLowerCase()
      const tick = (parsed.tick || '').toUpperCase()

      // Deduplicate: only allow one operation per (tick, op) per post
      const dedupeKey = tick + ':' + op
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      if (op === 'deploy') {
        if (!parsed.tick || !parsed.max || !parsed.lim) continue
        ops.push({
          p: 'mbc-20',
          op: 'deploy',
          tick,
          max: parsed.max,
          lim: parsed.lim,
        })
      }

      if (op === 'mint') {
        if (!parsed.tick || !parsed.amt) continue
        ops.push({
          p: 'mbc-20',
          op: 'mint',
          tick,
          amt: parsed.amt,
        })
      }

      if (op === 'transfer') {
        if (!parsed.tick || !parsed.amt || !parsed.to) continue
        ops.push({
          p: 'mbc-20',
          op: 'transfer',
          tick,
          amt: parsed.amt,
          to: parsed.to,
        })
      }

      if (op === 'burn') {
        if (!parsed.tick || !parsed.amt) continue
        const burnOp: any = {
          p: 'mbc-20',
          op: 'burn',
          tick,
          amt: parsed.amt,
        }
        if (parsed.address && /^0x[a-fA-F0-9]{40}$/.test(parsed.address)) {
          burnOp.address = parsed.address.toLowerCase()
        }
        ops.push(burnOp)
      }

      if (op === 'link') {
        if (!parsed.wallet || !/^0x[a-fA-F0-9]{40}$/.test(parsed.wallet)) continue
        ops.push({
          p: 'mbc-20',
          op: 'link',
          wallet: parsed.wallet.toLowerCase(),
        })
      }
    } catch {
      continue
    }
  }

  return ops
}

export function validateTick(tick: string): boolean {
  // 1-8 alphanumeric characters
  return /^[a-zA-Z0-9]{1,8}$/.test(tick)
}

export function parseAmount(amt: string): bigint | null {
  try {
    const num = BigInt(amt)
    return num > 0n ? num : null
  } catch {
    return null
  }
}
