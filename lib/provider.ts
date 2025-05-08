import { ethers } from "ethers"
import { getRpcUrl } from "./env-config"

let provider: ethers.JsonRpcProvider | null = null

/**
 * Get a provider instance
 */
export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(getRpcUrl())

    // Disable ENS to avoid unnecessary lookups
    // @ts-ignore - We're intentionally overriding a method
    provider.getResolver = async () => null
  }

  return provider
}

/**
 * Reset the provider (useful for testing)
 */
export function resetProvider(): void {
  provider = null
}
