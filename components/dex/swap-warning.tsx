import { AlertTriangle } from "lucide-react"
import type { Token } from "@/types/token"

interface SwapWarningProps {
  fromToken: Token
  toToken: Token
  className?: string
}

export function SwapWarning({ fromToken, toToken, className = "" }: SwapWarningProps) {
  // Check if this is a problematic pair
  const isHexToPlsx =
    (fromToken.symbol === "HEX" && toToken.symbol === "PLSX") ||
    (fromToken.symbol === "PLSX" && toToken.symbol === "HEX") ||
    (fromToken.address.toLowerCase() === "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39".toLowerCase() &&
      toToken.address.toLowerCase() === "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab".toLowerCase()) ||
    (fromToken.address.toLowerCase() === "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab".toLowerCase() &&
      toToken.address.toLowerCase() === "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39".toLowerCase())

  if (!isHexToPlsx) {
    return null
  }

  return (
    <div
      className={`bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded relative mb-4 ${className}`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">
            Warning: {fromToken.symbol} to {toToken.symbol} swaps may have higher slippage than quoted.
          </p>
          <p className="mt-1 text-xs">
            We're using the 9mm token as an intermediary for better routing. Consider using a higher slippage tolerance
            (5%+).
          </p>
        </div>
      </div>
    </div>
  )
}
