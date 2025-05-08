import {
  getTestnetRpcUrl as getEnvTestnetRpcUrl,
  getTestnetWplsAddress as getEnvTestnetWplsAddress,
  getTestnetRouterAddress as getEnvTestnetRouterAddress,
} from "./env-config"

// PulseChain Testnet Chain ID
export const TESTNET_CHAIN_ID = 943

// PulseChain Testnet RPC URL - using environment variable with fallback
export const TESTNET_RPC_URL = getEnvTestnetRpcUrl()

// PulseChain Testnet WS URL
export const TESTNET_WS_URL = "wss://rpc-testnet-pulsechain.g4mm4.io"

// PulseChain Testnet Explorer
export const TESTNET_EXPLORER_URL = "https://scan.v4.testnet.pulsechain.com"

// PulseChain Testnet Faucet API
export const TESTNET_FAUCET_API_URL = "https://faucet-api-v4.pulsechain.com"

// Native tPLS token (for display in the UI)
export const NATIVE_TPLS = {
  symbol: "tPLS",
  name: "Test PulseChain",
  address: "NATIVE", // Special identifier for the native token
  decimals: 18,
  logoURI: "/tpls-logo.svg", // We'll create this logo
  isNative: true,
  isTestnet: true,
}

// Featured token addresses for testnet - CORRECTED ADDRESSES for PulseChain Testnet V4
export const TESTNET_FEATURED_TOKENS = {
  tPLS: "NATIVE", // Use "NATIVE" for the native token
  WPLS: "0x70499adEBB11Efd915E3b69E700c331778628707", // Testnet WPLS address (verified)
  PLSX: "0x8a810ea8B121d08342E9e7696f4a9915cBE494B7", // Corrected Testnet PLSX address
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // Testnet HEX address (verified)
}

// Re-export the helper functions from env-config
export const getTestnetRpcUrl = getEnvTestnetRpcUrl
export const getTestnetRouterAddress = getEnvTestnetRouterAddress
export const getTestnetWplsAddress = getEnvTestnetWplsAddress
