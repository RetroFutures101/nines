import { ethers } from "ethers"
import { ROUTER_ADDRESSES, FACTORY_ADDRESSES, WPLS_ADDRESS } from "./constants"

// Define DEX types
export type DexType = "PULSEX_V1" | "PULSEX_V2" | "NINEMM_V2" | "NINEMM_V3"

// Define DEX info structure
export interface DexInfo {
  id: DexType
  name: string
  version: string
  routerAddress: string
  factoryAddress: string
  color: string
  logo?: string
}

// DEX information
export const DEX_INFO: Record<DexType, DexInfo> = {
  PULSEX_V1: {
    id: "PULSEX_V1",
    name: "PulseX",
    version: "V1",
    routerAddress: ROUTER_ADDRESSES.PULSEX_V1,
    factoryAddress: FACTORY_ADDRESSES.PULSEX_V1,
    color: "#ff3385",
    logo: "/pulsex-logo.svg",
  },
  PULSEX_V2: {
    id: "PULSEX_V2",
    name: "PulseX",
    version: "V2",
    routerAddress: ROUTER_ADDRESSES.PULSEX_V2,
    factoryAddress: FACTORY_ADDRESSES.PULSEX_V2,
    color: "#ff3385",
    logo: "/pulsex-logo.svg",
  },
  NINEMM_V2: {
    id: "NINEMM_V2",
    name: "9mm",
    version: "V2",
    routerAddress: ROUTER_ADDRESSES.NINEMM_V2,
    factoryAddress: FACTORY_ADDRESSES.NINEMM_V2,
    color: "#3366ff",
    logo: "/9mm-logo.svg",
  },
  NINEMM_V3: {
    id: "NINEMM_V3",
    name: "9mm",
    version: "V3",
    routerAddress: ROUTER_ADDRESSES.NINEMM_V3,
    factoryAddress: FACTORY_ADDRESSES.NINEMM_V3,
    color: "#3366ff",
    logo: "/9mm-logo.svg",
  },
}

// Define quote result interface
export interface DexQuote {
  dexInfo: DexInfo
  outputAmount: ethers.BigNumber
  estimatedGas: ethers.BigNumber
  path: string[]
  priceImpact: number
}

// Aggregator service
export class DexAggregator {
  private provider: ethers.providers.Provider

  constructor(provider: ethers.providers.Provider) {
    this.provider = provider
  }

  // Get quotes from all DEXes
  async getQuotes(fromToken: string, toToken: string, amount: ethers.BigNumber): Promise<DexQuote[]> {
    // In a real implementation, this would call each DEX's router to get quotes
    // For now, we'll simulate quotes with mock data

    // Get quotes from each DEX (this would be replaced with actual calls)
    const quotes: DexQuote[] = []

    for (const dexType of Object.keys(DEX_INFO) as DexType[]) {
      try {
        const dexInfo = DEX_INFO[dexType]

        // Simulate different quotes from different DEXes
        // In a real implementation, this would call the router contract
        const multiplier = this.getRandomMultiplier(dexType)
        const outputAmount = amount.mul(multiplier).div(100)

        quotes.push({
          dexInfo,
          outputAmount,
          estimatedGas: ethers.BigNumber.from(200000),
          path: [fromToken, WPLS_ADDRESS, toToken],
          priceImpact: Math.random() * 5, // Random price impact between 0-5%
        })
      } catch (error) {
        console.error(`Error getting quote from ${dexType}:`, error)
      }
    }

    return quotes
  }

  // Get the best quote from all DEXes
  async getBestQuote(fromToken: string, toToken: string, amount: ethers.BigNumber): Promise<DexQuote | null> {
    const quotes = await this.getQuotes(fromToken, toToken, amount)

    if (quotes.length === 0) {
      return null
    }

    // Sort quotes by output amount (descending)
    quotes.sort((a, b) => {
      if (b.outputAmount.gt(a.outputAmount)) return 1
      if (b.outputAmount.lt(a.outputAmount)) return -1
      return 0
    })

    return quotes[0]
  }

  // Helper to simulate different quotes
  private getRandomMultiplier(dexType: DexType): number {
    // This simulates different rates from different DEXes
    // In a real implementation, this would be replaced with actual quotes
    const baseMultiplier = 105 // 1.05x the input amount

    switch (dexType) {
      case "PULSEX_V1":
        return baseMultiplier - 2
      case "PULSEX_V2":
        return baseMultiplier + 1
      case "NINEMM_V2":
        return baseMultiplier + 2
      case "NINEMM_V3":
        return baseMultiplier + 3
      default:
        return baseMultiplier
    }
  }
}

// Create a DEX aggregator instance
export function createDexAggregator(provider: ethers.providers.Provider): DexAggregator {
  return new DexAggregator(provider)
}
