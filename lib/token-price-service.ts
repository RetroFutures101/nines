import { getTokenPrice as getTokenPriceFromService } from "./price-service"

/**
 * Get token price - main function that tries different methods
 * This is a wrapper around the existing price service to maintain compatibility
 */
export async function getTokenPrice(tokenAddress: string): Promise<number | null> {
  return getTokenPriceFromService(tokenAddress)
}
