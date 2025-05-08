export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string | null
  price?: number | null
  priceChange?: number | null
  balance?: string
  isNative?: boolean
  isTestnet?: boolean
}
