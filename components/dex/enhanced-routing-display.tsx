import React from "react"
import type { RouteQuote } from "@/lib/enhanced-smart-routing"
import { ArrowRight } from "lucide-react"

interface EnhancedRoutingDisplayProps {
  routes: RouteQuote[]
}

export default function EnhancedRoutingDisplay({ routes }: EnhancedRoutingDisplayProps) {
  // Sort routes by percentage (descending)
  const sortedRoutes = [...routes].sort((a, b) => b.percentage - a.percentage)

  return (
    <div className="bg-[#111] rounded-md p-2 max-w-md">
      {sortedRoutes.map((route, index) => (
        <div key={index} className="mb-2 last:mb-0">
          <div className="flex items-center mb-1">
            <span className="text-sm font-medium text-white">{Math.round(route.percentage)}%</span>
            <span className="text-xs text-gray-400 ml-2">{route.version}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1">
            {route.path.map((token, tokenIndex) => (
              <React.Fragment key={tokenIndex}>
                <TokenBadge token={token} />
                {tokenIndex < route.path.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Helper component to display token badges
function TokenBadge({ token }: { token: string }) {
  // Map of known token addresses to symbols and colors
  const tokenInfo: Record<string, { symbol: string; color: string }> = {
    "0xA1077a294dDE1B09bB078844df40758a5D0f9a27": { symbol: "WPLS", color: "bg-blue-500" },
    "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab": { symbol: "PLSX", color: "bg-purple-500" },
    "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39": { symbol: "HEX", color: "bg-orange-500" },
    "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d": { symbol: "INC", color: "bg-green-500" },
    NATIVE: { symbol: "PLS", color: "bg-blue-500" },
  }

  const lowercaseToken = token.toLowerCase()
  const info = Object.entries(tokenInfo).find(([addr]) => addr.toLowerCase() === lowercaseToken)?.[1] || {
    symbol: token.substring(0, 4) + "..." + token.substring(token.length - 4),
    color: "bg-gray-500",
  }

  return <span className={`text-xs px-2 py-0.5 rounded ${info.color} text-white`}>{info.symbol}</span>
}
