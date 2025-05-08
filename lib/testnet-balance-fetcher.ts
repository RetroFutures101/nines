import { ethers } from "ethers"
import { getTestnetRpcUrl } from "./env-config"

/**
 * Direct implementation to fetch testnet token balances
 * This bypasses all the complex logic and directly queries the blockchain
 */
export async function fetchTestnetBalance(tokenAddress: string, userAddress: string): Promise<string> {
  console.log(`DIRECT FETCH: Getting balance for ${tokenAddress} and user ${userAddress}`)

  if (!userAddress || !tokenAddress) {
    console.log("Missing address parameters")
    return "0"
  }

  try {
    // Create a fresh provider for each call to avoid any caching issues
    const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())

    // Handle native token (tPLS)
    if (tokenAddress === "NATIVE") {
      try {
        const balance = await provider.getBalance(userAddress)
        const formatted = ethers.formatEther(balance)
        console.log(`DIRECT FETCH: Native tPLS balance: ${formatted}`)
        return formatted
      } catch (error) {
        console.error("DIRECT FETCH: Error fetching native balance:", error)
        return "0"
      }
    }

    // For ERC20 tokens
    try {
      // Minimal ABI for balanceOf and decimals
      const minimalABI = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
      ]

      // Verify the contract exists and is valid
      try {
        const code = await provider.getCode(tokenAddress)
        if (code === "0x" || code === "") {
          console.warn(`DIRECT FETCH: No contract code found at address ${tokenAddress}`)
          return "0"
        }
      } catch (codeError) {
        console.error(`DIRECT FETCH: Error checking contract code at ${tokenAddress}:`, codeError)
        return "0"
      }

      // Create contract instance
      const contract = new ethers.Contract(tokenAddress, minimalABI, provider)

      // Get decimals first with fallback
      let decimals = 18
      try {
        decimals = await contract.decimals()
        // Ensure decimals is a number
        decimals = typeof decimals === "number" ? decimals : Number(decimals)
      } catch (decimalError) {
        console.warn(`DIRECT FETCH: Could not get decimals for ${tokenAddress}, using default 18`)
      }

      // Try different methods to get balance
      let balance
      try {
        // Standard ERC20 balanceOf
        balance = await contract.balanceOf(userAddress)
      } catch (balanceError) {
        console.error(`DIRECT FETCH: Standard balanceOf failed for ${tokenAddress}:`, balanceError)

        // Try alternative method - some tokens have non-standard implementations
        try {
          // Try with a different ABI format
          const alternativeABI = ["function balanceOf(address owner) view returns (uint256)"]
          const altContract = new ethers.Contract(tokenAddress, alternativeABI, provider)
          balance = await altContract.balanceOf(userAddress)
        } catch (altError) {
          console.error(`DIRECT FETCH: Alternative balanceOf failed for ${tokenAddress}:`, altError)

          // Last resort - try a raw call to the balanceOf function
          try {
            // Create the function selector for balanceOf(address)
            const functionSelector = "0x70a08231" // balanceOf(address) selector
            // Encode the address parameter (pad to 32 bytes)
            const encodedAddress = ethers.zeroPadValue(userAddress, 32)
            // Combine the selector and encoded address
            const data = functionSelector + encodedAddress.substring(2) // Remove 0x prefix from encoded address

            // Make a raw call to the contract
            const result = await provider.call({
              to: tokenAddress,
              data: data,
            })

            if (result && result !== "0x") {
              balance = ethers.toBigInt(result)
            } else {
              console.error(`DIRECT FETCH: Raw call returned empty result for ${tokenAddress}`)
              return "0"
            }
          } catch (rawError) {
            console.error(`DIRECT FETCH: Raw call failed for ${tokenAddress}:`, rawError)
            return "0"
          }
        }
      }

      // Format the balance
      const formatted = ethers.formatUnits(balance, decimals)
      console.log(`DIRECT FETCH: Token ${tokenAddress} balance: ${formatted}`)
      return formatted
    } catch (error) {
      console.error(`DIRECT FETCH: Error fetching token balance for ${tokenAddress}:`, error)
      return "0"
    }
  } catch (error) {
    console.error(`DIRECT FETCH: Failed to get balance for ${tokenAddress}:`, error)
    return "0"
  }
}

/**
 * Verify if a contract exists at the given address
 */
export async function verifyTestnetContract(tokenAddress: string): Promise<boolean> {
  if (!tokenAddress || tokenAddress === "NATIVE") return true

  try {
    const provider = new ethers.JsonRpcProvider(getTestnetRpcUrl())
    const code = await provider.getCode(tokenAddress)
    return code !== "0x" && code !== ""
  } catch (error) {
    console.error(`Failed to verify contract at ${tokenAddress}:`, error)
    return false
  }
}
