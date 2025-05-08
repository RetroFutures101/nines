import type { Token } from "@/types/token"

interface TokenInput {
  token: Token
  amount: string
}

export interface MultiSwapQuoteParams {
  inputTokens: TokenInput[]
  outputToken: Token
  slippage: number
  isTestnet?: boolean
}

export interface MultiSwapQuoteResult {
  outputAmount: string
  priceImpact: number
  executionPrice?: number
  marketPrice?: number
  routeDescription?: string
}

export async function getMultiSwapQuote(params: MultiSwapQuoteParams): Promise<MultiSwapQuoteResult> {
  const { inputTokens, outputToken, slippage, isTestnet = false } = params

  try {
    console.log("Getting multi-swap quote for:", {
      inputTokens: inputTokens.map((i) => `${i.token.symbol}: ${i.amount}`),
      outputToken: outputToken.symbol,
      slippage,
      isTestnet,
    })

    // Calculate total input value in USD
    let totalInputValue = 0
    for (const input of inputTokens) {
      // Convert to common unit (e.g., USD)
      const inputAmount = Number.parseFloat(input.amount)
      const inputPrice = input.token.price || 0.0001 // Fallback to a small value if price is missing
      totalInputValue += inputAmount * inputPrice
      console.log(`Input: ${inputAmount} ${input.token.symbol} at $${inputPrice} = $${inputAmount * inputPrice}`)
    }

    console.log(`Total input value: $${totalInputValue}`)

    // Calculate output amount based on output token price
    const outputPrice = outputToken.price || 0.0001 // Fallback to a small value if price is missing
    console.log(`Output token ${outputToken.symbol} price: $${outputPrice}`)

    const simulatedOutput = totalInputValue / outputPrice
    console.log(`Raw output amount: ${simulatedOutput} ${outputToken.symbol}`)

    // Apply a simulated price impact based on number of input tokens
    const simulatedPriceImpact = 0.5 + inputTokens.length * 0.3 // 0.5% base + 0.3% per input token
    const adjustedOutput = simulatedOutput * (1 - simulatedPriceImpact / 100)
    console.log(`Adjusted output with ${simulatedPriceImpact}% price impact: ${adjustedOutput} ${outputToken.symbol}`)

    // Format the output amount with appropriate precision
    const formattedOutput = adjustedOutput.toFixed(outputToken.decimals <= 6 ? outputToken.decimals : 6)

    return {
      outputAmount: formattedOutput,
      priceImpact: simulatedPriceImpact,
      executionPrice: simulatedOutput / totalInputValue,
      marketPrice: simulatedOutput / totalInputValue,
      routeDescription: `Multi-asset swap via aggregation (${inputTokens.length} tokens)`,
    }
  } catch (error) {
    console.error("Failed to get multi-swap quote:", error)

    // Return a fallback quote to prevent UI from breaking
    return {
      outputAmount: "0",
      priceImpact: 0,
      routeDescription: "Failed to calculate quote",
    }
  }
}
