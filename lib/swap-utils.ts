import { ethers } from "ethers"
import { getRpcUrl } from "./env-config"

// Create a provider with ENS explicitly disabled
export function createProvider(): ethers.JsonRpcProvider {
  const rpcUrl = getRpcUrl()

  // Create a basic provider with no network specification
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  // Explicitly disable ENS by overriding the getResolver method
  // @ts-ignore - We're intentionally overriding a method
  provider.getResolver = async () => null

  return provider
}

export async function createSigner(provider: ethers.Provider) {
  // This is just a placeholder - in a real app, you'd connect to a wallet
  return new ethers.Wallet(ethers.ZeroHash, provider)
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

export function isNativeToken(tokenAddress: string): boolean {
  return tokenAddress === "NATIVE"
}

export function formatCurrency(value: string | number, decimals = 6): string {
  const numValue = typeof value === "string" ? Number.parseFloat(value) : value

  if (isNaN(numValue)) return "0.00"

  // For very small numbers, use scientific notation
  if (numValue > 0 && numValue < 0.000001) {
    return numValue.toExponential(2)
  }

  // For zero or very close to zero
  if (Math.abs(numValue) < 1e-10) {
    return "0.00"
  }

  // For regular numbers
  return numValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })
}

export function formatPrice(value: string | number): string {
  const numValue = typeof value === "string" ? Number.parseFloat(value) : value

  if (isNaN(numValue) || numValue === 0) return "$0.00"

  // For very small numbers, use scientific notation
  if (numValue > 0 && numValue < 0.000001) {
    return "$" + numValue.toExponential(2)
  }

  // For zero or very close to zero
  if (Math.abs(numValue) < 1e-10) {
    return "$0.00"
  }

  // For regular numbers
  return (
    "$" +
    numValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
  )
}

export function formatPercentage(value: string | number): string {
  const numValue = typeof value === "string" ? Number.parseFloat(value) : value

  if (isNaN(numValue)) return "0.00%"

  return (
    numValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  )
}

export function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (!address) return ""
  if (address.length <= startLength + endLength) return address

  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`
}
