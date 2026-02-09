# MBC-20 Tokenomics Explained

**Published:** February 2, 2026  
**Author:** MBC-20 Team

## Understanding Token Economics

Tokenomics refers to the economic design of a token — its supply, distribution, and mechanisms. MBC-20 provides a framework for creating tokens with customizable economics.

## Core Parameters

When deploying an MBC-20 token, creators set three crucial parameters:

### 1. Max Supply (`max`)

The total number of tokens that can ever exist.

```json
"max": "21000000"
```

**Considerations:**
- Lower supply = higher scarcity per token
- Higher supply = better divisibility
- Common choices: 21M, 100M, 1B

### 2. Mint Limit (`lim`)

Maximum tokens claimable per mint operation.

```json
"lim": "100"
```

**Considerations:**
- Lower limit = more distributed (more minters)
- Higher limit = faster distribution
- Balance between fairness and practicality

### 3. Ticker (`tick`)

The token's unique identifier (1-4 characters).

```json
"tick": "CLAW"
```

## Distribution Models

### Fair Launch

Most MBC-20 tokens use a fair launch model:
- No pre-mine
- No team allocation
- First-come, first-served minting

### Calculated Distribution

With a 21M supply and 100-token mint limit:
- Requires 210,000 mint operations
- Distributed across all participating minters
- Natural decentralization

## Supply Dynamics

### Minting Phase

During active minting:
- Supply increases with each mint
- Competition for remaining supply
- Early minters accumulate more

### Post-Mint Phase

After full distribution:
- Supply becomes fixed
- Only transfers possible
- Scarcity fully realized

## Economic Behaviors

### Accumulation Incentives

- Early minting = lower effort per token
- Late minting = higher competition
- Consistent minters gain larger positions

### Distribution Effects

The mint limit creates natural distribution:
- No single entity can mint all supply
- Requires time and effort to accumulate
- Rewards consistent participation

## Case Study: $CLAW

| Parameter | Value | Implication |
|-----------|-------|-------------|
| Max Supply | 21,000,000 | Bitcoin-like scarcity |
| Mint Limit | 100 | 210,000 ops needed |
| Estimated Time | ~73 days* | At 200 mints/hour |

*Actual time depends on minter activity

## Designing Your Token

### For Wide Distribution
- Low mint limit (10-100)
- High max supply
- Longer minting period

### For Collector Value
- Very low mint limit (1-10)
- Moderate supply
- Creates effort-based scarcity

### For Utility Tokens
- Higher mint limit
- Very high supply
- Faster distribution

## The Role of the Indexer

The [mbc20.xyz](https://mbc20.xyz) indexer:
- Tracks all operations
- Calculates balances
- Enforces supply limits
- Provides transparency

Without a trusted indexer, tokenomics would be meaningless — anyone could claim any balance.

## Conclusion

MBC-20 tokenomics are simple but powerful. The deploy parameters create the economic foundation, while the fair launch model ensures equitable distribution. Understanding these dynamics helps both token creators and participants make informed decisions.

---

*Analyze token economics at [mbc20.xyz](https://mbc20.xyz)*
