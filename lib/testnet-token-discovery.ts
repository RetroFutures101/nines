import { ethers } from "ethers"
import { getTestnetRpcUrl } from "./env-config"

/**
 * Utility to discover and verify token addresses on the testnet
 */
export async function discoverTestnetToken(tokenSymbol: string): Promise<string | null> {
  console.log(`Attempting to discover testnet token address for ${tokenSymbol}...`)

  try {
    const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())

    // Common token addresses to check based on symbol
    const possibleAddresses: Record<string, string[]> = {
      PLSX: [
        "0x8a810ea8B121d08342E9e7696f4a9915cBE494B7", // Correct testnet address
        "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab", // Incorrect/mainnet address
      ],
      HEX: ["0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39"],
      WPLS: ["0x70499adEBB11Efd915E3b69E700c331778628707"],
      // Add more tokens as needed
    }

    // If we have possible addresses for this token, check them
    if (possibleAddresses[tokenSymbol]) {
      for (const address of possibleAddresses[tokenSymbol]) {
        try {
          // Check if there's contract code at this address
          const code = await provider.getCode(address)
          if (code !== "0x" && code !== "") {
            // Verify it's an ERC20 token by checking for symbol and name
            const minimalABI = ["function symbol() view returns (string)", "function name() view returns (string)"]

            const contract = new ethers.Contract(address, minimalABI, provider)

            try {
              const symbol = await contract.symbol()
              const name = await contract.name()

              console.log(`Found token at ${address}: ${name} (${symbol})`)

              // Verify the symbol matches what we're looking for
              if (symbol.toUpperCase() === tokenSymbol.toUpperCase()) {
                console.log(`Verified ${tokenSymbol} at address ${address}`)
                return address
              } else {
                console.log(`Symbol mismatch: expected ${tokenSymbol}, got ${symbol}`)
              }
            } catch (error) {
              console.error(`Error verifying token at ${address}:`, error)
            }
          } else {
            console.log(`No contract code found at ${address}`)
          }
        } catch (error) {
          console.error(`Error checking address ${address}:`, error)
        }
      }
    }

    console.log(`Could not discover address for ${tokenSymbol}`)
    return null
  } catch (error) {
    console.error(`Error discovering token address:`, error)
    return null
  }
}

/**
 * Verify all testnet token addresses
 */
export async function verifyAllTestnetTokens(tokenAddresses: Record<string, string>): Promise<Record<string, string>> {
  const verifiedAddresses: Record<string, string> = {}

  for (const [symbol, address] of Object.entries(tokenAddresses)) {
    // Skip native token
    if (address === "NATIVE") {
      verifiedAddresses[symbol] = address
      continue
    }

    try {
      const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())

      // Check if there's contract code at this address
      const code = await provider.getCode(address)
      if (code !== "0x" && code !== "") {
        console.log(`Verified ${symbol} at address ${address}`)
        verifiedAddresses[symbol] = address
      } else {
        console.log(`No contract code found for ${symbol} at ${address}, attempting discovery...`)
        const discoveredAddress = await discoverTestnetToken(symbol)
        if (discoveredAddress) {
          console.log(`Discovered ${symbol} at address ${discoveredAddress}`)
          verifiedAddresses[symbol] = discoveredAddress
        } else {
          console.warn(`Could not verify or discover address for ${symbol}`)
        }
      }
    } catch (error) {
      console.error(`Error verifying token ${symbol} at ${address}:`, error)
    }
  }

  return verifiedAddresses
}
