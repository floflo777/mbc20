import { http, createConfig } from "wagmi"
import { baseSepolia, base } from "wagmi/chains"
import { getDefaultConfig } from "connectkit"

const isTestnet = process.env.NEXT_PUBLIC_CHAIN === "testnet"

export const config = createConfig(
  getDefaultConfig({
    chains: isTestnet ? [baseSepolia] : [base],
    transports: isTestnet
      ? { [baseSepolia.id]: http() }
      : { [base.id]: http() },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    appName: "mbc-20 Marketplace",
    appDescription: "Trade mbc-20 inscription tokens on Base",
    appUrl: "https://mbc20.xyz",
  })
)

// Contract addresses (Base Sepolia testnet)
export const CONTRACTS = {
  claimManager: "0x09C73fee7c7Ff83BB0B8387DB4029Cd1f43A5338" as `0x${string}`,
  factory: "0x1F35A894d53FBBBA03B20A34abBD3E50ACD6D7AD" as `0x${string}`,
  marketplace: "0xa870E663aeFdD527c96Eebf5EDC0E622A6EA7074" as `0x${string}`,
  usdc: "0x49FE99696Eb09C204E96E623188A546ac2ee0B84" as `0x${string}`,
}

export const CLAIM_MANAGER_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tick", type: "string" },
      { name: "totalAmount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "claimFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "initToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tick", type: "string" },
      { name: "maxSupply", type: "uint256" },
    ],
    outputs: [],
  },
] as const

export const MARKETPLACE_ABI = [
  {
    name: "list",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "pricePerToken", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "buy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "orders",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "pricePerToken", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "orderCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const

export const FACTORY_ABI = [
  {
    name: "getToken",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tick", type: "string" }],
    outputs: [{ type: "address" }],
  },
] as const
