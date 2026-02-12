# MBC-20 Deployment Guide

## V1 Contracts (Mainnet — Live)

| Contract | Address |
|---|---|
| ClaimManager | `0x08EbdA4c5dcDA94385D86EAc267f89E46EafCE11` |
| MBC20Factory | `0xAD3dE9dBBF33B3a2EbB57086C30d15584f74aE33` |
| MBC20Marketplace | `0xfa1c15539E1740a8B0078211b01F00ed49E2C5A8` |
| CLAW Token | `0x869F37b5eD9244e4Bc952EEad011E04E7860E844` |

## V2 Contracts (Permissionless — Coming Soon)

### Deployment

```bash
cp .env.example .env
# Fill in DEPLOYER_PK, SIGNER_ADDRESS, etc.

npm install
npx hardhat compile
npx hardhat test

# Deploy to Base mainnet
npx hardhat run scripts/deploy-v2.js --network base
```

### Deployment Order (automated by script)
1. Predict FactoryV2 address from deployer nonce
2. Deploy ClaimManagerV2(factoryV2, signer)
3. Deploy FactoryV2(claimManagerV2, clawToken, deploymentCost)
4. Verify on Basescan

### Verification

```bash
npx hardhat verify --network base <ClaimManagerV2> <factoryV2Addr> <signerAddr>
npx hardhat verify --network base <FactoryV2> <claimManagerV2Addr> <clawTokenAddr> <deploymentCost>
```

## Key Addresses

| Role | Address |
|---|---|
| Deployer | `0xcd591786158F039beBB99F0219C747FC7f95Ed9F` |
| Signer | `0x22dA4D6314B863dD7c3a39E6f338c8cF0BEC7d9f` |
| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| CLAW Token | `0x869F37b5eD9244e4Bc952EEad011E04E7860E844` |
