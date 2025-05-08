"use client"

import {
  getRpcUrl as getEnvRpcUrl,
  getRouterAddress as getEnvRouterAddress,
  getWplsAddress as getEnvWplsAddress,
} from "./env-config"

// PulseChain Chain ID
export const CHAIN_ID = 369

// PulseChain RPC URL - using environment variable with fallback
export const RPC_URL = getEnvRpcUrl()

// PulseChain Subgraph URL
export const SUBGRAPH_URL = "https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexV2"

// Moralis API Key
export const MORALIS_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImU3MWRjODkzLWFmNzctNDVlOS1iZWVlLTRiMDU0OWViN2NkNiIsIm9yZ0lkIjoiNDM0NzYyIiwidXNlcklkIjoiNDQ3MjQzIiwidHlwZUlkIjoiYTJhMzRkNzgtOGVlMC00YzNmLTlhN2YtNjg5ZmMyNDYyOTllIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDEwOTk0NzgsImV4cCI6NDg5Njg1OTQ3OH0.Htc6174whKF1InuEPb8xezPXam0_U5ysFWafRQCORnE"

// Moralis API Base URL
export const MORALIS_API_BASE_URL = "https://deep-index.moralis.io/api/v2.2"

// Native PLS token (for display in the UI)
export const NATIVE_PLS = {
  symbol: "PLS",
  name: "PulseChain",
  address: "NATIVE", // Special identifier for the native token
  decimals: 18,
  logoURI: null, // We'll use WPLS logo
  isNative: true,
}

// Featured token addresses - properly checksummed
// These are the official addresses from PulseChain
export const FEATURED_TOKENS = {
  PLS: "NATIVE", // Use "NATIVE" for the native token
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27", // Wrapped PLS
  PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // PulseX
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // HEX
  NINEMM: "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719", // 9mm token
}

// WPLS address for price calculations - using environment variable with fallback
export const WPLS_ADDRESS = getEnvWplsAddress()

// Router address from environment variable
export const ROUTER_ADDRESS = getEnvRouterAddress()

// 9mm DEX Router Addresses - updated with correct addresses
export const NINEMM_V2_ROUTER = "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47"
export const NINEMM_V3_ROUTER = "0xf6076d61A0C46C944852F65838E1b12A2910a717" // Updated with correct address

// 9mm DEX Factory Addresses - updated with correct addresses
export const NINEMM_V2_FACTORY = "0x3a0Fa7884dD93f3cd234bBE2A0958Ef04b05E13b"
export const NINEMM_V3_FACTORY = "0xe50DbDC88E87a2C92984d794bcF3D1d76f619C68" // Updated with correct address

// Maintain the original FACTORY_ADDRESS for backward compatibility
export const FACTORY_ADDRESS = NINEMM_V2_FACTORY

// Maintain the original ROUTER_V2_ADDRESS for backward compatibility
export const ROUTER_V2_ADDRESS = NINEMM_V2_ROUTER

// Consolidated router and factory addresses - removed PulseX routers as requested
export const ROUTER_ADDRESSES = {
  NINEMM_V2: NINEMM_V2_ROUTER,
  NINEMM_V3: NINEMM_V3_ROUTER,
}

export const FACTORY_ADDRESSES = {
  NINEMM_V2: NINEMM_V2_FACTORY,
  NINEMM_V3: NINEMM_V3_FACTORY,
}

// Default router and factory to use
export const DEFAULT_ROUTER = ROUTER_ADDRESSES.NINEMM_V2
export const DEFAULT_FACTORY = FACTORY_ADDRESSES.NINEMM_V2

// GoPulse API URL for token images
export const GOPULSE_API_URL = "https://gopulse.com/api/v1"

// Re-export the helper functions from env-config
export const getRpcUrl = getEnvRpcUrl
export const getWplsAddress = getEnvWplsAddress
export const getRouterAddress = getEnvRouterAddress

// Gas settings
export const GAS_LIMIT_ADJUSTMENT = 1.2 // 20% buffer
export const DEFAULT_GAS_LIMIT = "300000" // Use string instead of BigNumber

// Slippage settings
export const DEFAULT_SLIPPAGE_TOLERANCE = 0.5 // 0.5%
export const MAX_SLIPPAGE_TOLERANCE = 50 // 50%

// Deadline settings
export const DEFAULT_DEADLINE_MINUTES = 20

// Transaction settings
export const MAX_APPROVAL_AMOUNT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // MaxUint256 as hex string

// Multi-hop settings
export const MAX_HOPS = 3
export const DEFAULT_INTERMEDIARY_TOKENS = [WPLS_ADDRESS]

// Price impact warning thresholds
export const PRICE_IMPACT_WARNING = 2 // 2%
export const PRICE_IMPACT_HIGH = 5 // 5%
export const PRICE_IMPACT_EXTREME = 10 // 10%
