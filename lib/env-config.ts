// Environment variables hardcoded with exact values
export const ENV_CONFIG = {
  // PulseChain Mainnet
  NEXT_PUBLIC_RPC_URL: "https://rpc-pulsechain.g4mm4.io",
  NEXT_PUBLIC_ROUTER_ADDRESS: "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47", // 9mm V2 router
  NEXT_PUBLIC_WPLS_ADDRESS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27", // Hardcoded as requested

  // PulseChain Testnet
  NEXT_PUBLIC_TESTNET_RPC_URL: "https://rpc-testnet-pulsechain.g4mm4.io",
  NEXT_PUBLIC_TESTNET_ROUTER_ADDRESS: "0xcC73b59F8D7b7c532703bDfea2808a28a488cF47", // 9mm V2 router
  NEXT_PUBLIC_TESTNET_WPLS_ADDRESS: "0x70499adEBB11Efd915E3b69E700c331778628707",
}

// Helper functions that always return the hardcoded values
export const getRpcUrl = () => {
  return ENV_CONFIG.NEXT_PUBLIC_RPC_URL
}

export const getRouterAddress = () => {
  return ENV_CONFIG.NEXT_PUBLIC_ROUTER_ADDRESS
}

export const getWplsAddress = () => {
  return ENV_CONFIG.NEXT_PUBLIC_WPLS_ADDRESS
}

// Testnet helpers
export const getTestnetRpcUrl = () => {
  return ENV_CONFIG.NEXT_PUBLIC_TESTNET_RPC_URL
}

export const getTestnetRouterAddress = () => {
  return ENV_CONFIG.NEXT_PUBLIC_TESTNET_ROUTER_ADDRESS
}

export const getTestnetWplsAddress = () => {
  return ENV_CONFIG.NEXT_PUBLIC_TESTNET_WPLS_ADDRESS
}
