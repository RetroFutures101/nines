/**
 * Advanced Routing
 * Implements optimized swap path generation based on token types.
 */

import { getWplsAddress } from "./env-config"
import { ethers } from "ethers"
import { NINEMM_V2_FACTORY, NINEMM_V3_FACTORY, NINEMM_V2_ROUTER, NINEMM_V3_ROUTER } from "./constants"
import { WPLS_ADDRESS } from "./constants"

// Define token addresses for routing
const TOKEN_ADDRESSES = {
  // Main tokens
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab",
  INC: "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d",
  DAI: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",
  NINEMM: "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719", // 9mm token

  // Native stablecoins
  HEXDC: "0x1FE0319440A672526916C232EAEe4808254Bdb00",
  PXDC: "0xeB6b7932Da20c6D7B3a899D5887d86dfB09A6408",
  INCD: "0x144Cd22AaA2a80FEd0Bb8B1DeADDc51A53Df1d50",
  USDL: "0x0dEEd1486bc52aA0d3E6f8849cEC5adD6598A162",
  CST: "0x5e3c572a3e793a7d3b837c5df7af1be0a896c956",

  // Other common tokens
  USDC: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07",
  USDT: "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f",
}

// Richard Heart tokens with deep liquidity (RH tokens)
export const PRIMARY_TOKENS = {
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27", // WPLS
  PLSX: "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // PulseX
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // HEX
  HEXDC: "0x1FE0319440A672526916C232EAEe4808254Bdb00", // HEX Decentralized Currency
  PXDC: "0xeB6b7932Da20c6D7B3a899D5887d86dfB09A6408", // PulseX Decentralized Currency
  INC: "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d", // Inception
  INCD: "0x144Cd22AaA2a80FEd0Bb8B1DeADDc51A53Df1d50", // Inception Decentralized Currency
  NINEMM: "0x7b39712Ef45F7dcED2bBDF11F3D5046bA61dA719", // Added 9mm token
}

// Bridged stablecoins with good liquidity (BS tokens)
export const STABLECOINS = {
  DAI: "0xefD766cCb38EaF1dfd701853BFCe31359239F305", // DAI
  USDC: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07", // USDC
  USDT: "0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f", // USDT
}

// Testnet token addresses
export const TESTNET_TOKENS = {
  WPLS: "0x70499adEBB11Efd915E3b69E700c331778628707", // Testnet WPLS
  PLSX: "0x8a810ea8B121d08342E9e7696f4a9915cBE494B7", // Testnet PLSX
  HEX: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", // Testnet HEX
}

// Protocol versions with their factory addresses - updated to focus on 9mm only
export const PROTOCOL_VERSIONS = {
  // 9mm versions
  NINEMM_V2: {
    factory: NINEMM_V2_FACTORY,
    name: "9mm V2",
    routerAddress: NINEMM_V2_ROUTER,
    dex: "9mm",
  },
  NINEMM_V3: {
    factory: NINEMM_V3_FACTORY,
    name: "9mm V3",
    routerAddress: NINEMM_V3_ROUTER,
    dex: "9mm",
  },
  // Legacy versions (for backward compatibility)
  V2: {
    factory: NINEMM_V2_FACTORY,
    name: "V2",
    routerAddress: NINEMM_V2_ROUTER,
    dex: "9mm",
  },
  V3: {
    factory: NINEMM_V3_FACTORY,
    name: "V3",
    routerAddress: NINEMM_V3_ROUTER,
    dex: "9mm",
  },
}

/**
 * Generate optimized paths for token swaps
 * Prioritizes paths through Richard Heart tokens and 9mm
 */
export function generateOptimizedPaths(
  fromToken: string,
  toToken: string,
  isTestnet = false,
): { path: string[]; description: string }[] {
  // Handle native token (PLS)
  const actualFromToken = fromToken === "NATIVE" ? WPLS_ADDRESS : fromToken
  const actualToToken = toToken === "NATIVE" ? WPLS_ADDRESS : toToken

  // Initialize paths array
  const paths: { path: string[]; description: string }[] = []

  // Always include direct path
  if (actualFromToken.toLowerCase() !== actualToToken.toLowerCase()) {
    paths.push({
      path: [actualFromToken, actualToToken],
      description: "direct path",
    })
  }

  // Richard Heart tokens and 9MM for multihops
  const priorityTokens = [
    WPLS_ADDRESS, // WPLS
    TOKEN_ADDRESSES.PLSX, // PLSX
    TOKEN_ADDRESSES.HEX, // HEX
    TOKEN_ADDRESSES.INC, // INC
    TOKEN_ADDRESSES.NINEMM, // 9MM
  ]

  // Add paths via priority tokens
  for (const intermediary of priorityTokens) {
    if (
      intermediary.toLowerCase() !== actualFromToken.toLowerCase() &&
      intermediary.toLowerCase() !== actualToToken.toLowerCase()
    ) {
      paths.push({
        path: [actualFromToken, intermediary, actualToToken],
        description: `via ${getSymbolFromAddress(intermediary)}`,
      })
    }
  }

  // Add paths via stablecoins
  const stablecoins = [TOKEN_ADDRESSES.DAI, TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.USDT]

  for (const stablecoin of stablecoins) {
    if (
      stablecoin.toLowerCase() !== actualFromToken.toLowerCase() &&
      stablecoin.toLowerCase() !== actualToToken.toLowerCase()
    ) {
      paths.push({
        path: [actualFromToken, stablecoin, actualToToken],
        description: `via ${stablecoin === TOKEN_ADDRESSES.DAI ? "DAI" : stablecoin === TOKEN_ADDRESSES.USDC ? "USDC" : "USDT"}`,
      })
    }
  }

  // Add multi-hop paths for potentially better rates
  // Try paths through WPLS and 9MM
  if (
    actualFromToken.toLowerCase() !== WPLS_ADDRESS.toLowerCase() &&
    actualToToken.toLowerCase() !== WPLS_ADDRESS.toLowerCase() &&
    actualFromToken.toLowerCase() !== TOKEN_ADDRESSES.NINEMM.toLowerCase() &&
    actualToToken.toLowerCase() !== TOKEN_ADDRESSES.NINEMM.toLowerCase()
  ) {
    paths.push({
      path: [actualFromToken, WPLS_ADDRESS, TOKEN_ADDRESSES.NINEMM, actualToToken],
      description: "via WPLS and 9MM",
    })

    paths.push({
      path: [actualFromToken, TOKEN_ADDRESSES.NINEMM, WPLS_ADDRESS, actualToToken],
      description: "via 9MM and WPLS",
    })
  }

  // Filter out duplicate paths
  const uniquePaths: { path: string[]; description: string }[] = []
  const pathStrings = new Set<string>()

  for (const pathObj of paths) {
    const pathString = pathObj.path.map((addr) => addr.toLowerCase()).join("-")
    if (!pathStrings.has(pathString)) {
      pathStrings.add(pathString)
      uniquePaths.push(pathObj)
    }
  }

  return uniquePaths
}

/**
 * Get optimal split routes for a token pair
 * @returns Array of routes with percentages and versions
 */
export function getOptimalSplitRoutes(
  fromToken: string,
  toToken: string,
): {
  path: string[]
  percentage: number
  version: string
}[] {
  // Default split routing using 9mm V2 and V3
  const wplsAddress = getWplsAddress()

  // For tokens that aren't WPLS, route through WPLS
  if (fromToken.toLowerCase() !== wplsAddress.toLowerCase() && toToken.toLowerCase() !== wplsAddress.toLowerCase()) {
    return [
      {
        path: [fromToken, wplsAddress, toToken],
        percentage: 50,
        version: "NINEMM_V2",
      },
      {
        path: [fromToken, wplsAddress, toToken],
        percentage: 50,
        version: "NINEMM_V3",
      },
    ]
  }

  // Direct route for simple cases
  return [
    {
      path: [fromToken, toToken],
      percentage: 50,
      version: "NINEMM_V2",
    },
    {
      path: [fromToken, toToken],
      percentage: 50,
      version: "NINEMM_V3",
    },
  ]
}

/**
 * Helper function to get token symbol from address
 */
function getSymbolFromAddress(address: string): string {
  // Check in PRIMARY_TOKENS
  for (const [symbol, addr] of Object.entries(PRIMARY_TOKENS)) {
    if (addr.toLowerCase() === address.toLowerCase()) {
      return symbol
    }
  }

  // Check in STABLECOINS
  for (const [symbol, addr] of Object.entries(STABLECOINS)) {
    if (addr.toLowerCase() === address.toLowerCase()) {
      return symbol
    }
  }

  // Check in TESTNET_TOKENS
  for (const [symbol, addr] of Object.entries(TESTNET_TOKENS)) {
    if (addr.toLowerCase() === address.toLowerCase()) {
      return symbol
    }
  }

  // Return shortened address if no symbol found
  return address.substring(0, 6) + "..." + address.substring(address.length - 4)
}

/**
 * Split an amount according to route percentages
 */
export function splitAmountByRoutes(
  amount: ethers.BigNumberish,
  routes: { path: string[]; percentage: number; version: string }[],
): { path: string[]; amount: ethers.BigNumberish; version: string }[] {
  const totalAmount = ethers.getBigInt(amount.toString())

  return routes.map((route) => {
    const routeAmount = (totalAmount * ethers.getBigInt(route.percentage)) / ethers.getBigInt(100)
    return {
      path: route.path,
      amount: routeAmount,
      version: route.version,
    }
  })
}

/**
 * Get router address for a specific version
 */
export function getRouterAddressByVersion(version: string): string {
  return PROTOCOL_VERSIONS[version]?.routerAddress || PROTOCOL_VERSIONS.NINEMM_V2.routerAddress
}

/**
 * Get human-readable route description
 */
export function getRouteDescription(route: { path: string[]; percentage: number; version: string }): string {
  const tokens = route.path.map((addr) => getSymbolFromAddress(addr))
  const dexName = PROTOCOL_VERSIONS[route.version]?.dex || "DEX"
  return `${tokens.join(" → ")} (${dexName} ${PROTOCOL_VERSIONS[route.version]?.name || route.version}, ${route.percentage}%)`
}
