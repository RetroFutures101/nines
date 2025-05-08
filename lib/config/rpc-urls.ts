// Hardcoded RPC URLs for PulseChain
export const PULSECHAIN_MAINNET_RPC = "https://rpc-pulsechain.g4mm4.io"
export const PULSECHAIN_TESTNET_RPC = "https://rpc-testnet-pulsechain.g4mm4.io"

// Helper functions to get the correct RPC URL
export function getRpcUrl(): string {
  return PULSECHAIN_MAINNET_RPC
}

export function getTestnetRpcUrl(): string {
  return PULSECHAIN_TESTNET_RPC
}
