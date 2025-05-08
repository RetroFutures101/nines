/**
 * Utility to analyze Midgard assets and extract token information
 */
import { findAllTokensInAssets } from "../lib/midgard-asset-parser"

// This function can be run to extract all token information from Midgard assets
async function analyzeAndPrintTokens() {
  console.log("Analyzing Midgard assets...")

  try {
    const tokens = await findAllTokensInAssets()

    console.log(`Found ${tokens.length} tokens in Midgard assets:`)
    console.table(tokens)

    // Create a mapping of tokens by symbol for easy reference
    const tokensBySymbol: Record<string, any> = {}
    tokens.forEach((token) => {
      if (token.symbol) {
        tokensBySymbol[token.symbol] = token
      }
    })

    console.log("Tokens by symbol:", tokensBySymbol)

    // Provide some examples of how to use this data
    console.log("Example usage:")
    console.log("- Copy this data to create a more comprehensive token list")
    console.log("- Use these addresses to populate your DEX")
    console.log("- Reference this data to improve token icons")

    return tokens
  } catch (error) {
    console.error("Error analyzing Midgard assets:", error)
    return []
  }
}

// Export a function to run the analysis
export function analyzeMidgardAssets() {
  return analyzeAndPrintTokens()
}
