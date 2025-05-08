"use client"

import { useState, useEffect } from "react"
import { ethers } from "ethers"
import type { DexQuote, DexType } from "../../lib/dex-aggregator"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, AlertCircle } from "lucide-react"

interface DexAggregatorProps {
  fromToken: string
  toToken: string
  amount: ethers.BigNumber
  quotes: DexQuote[] | null
  selectedDex: DexType | null
  isLoading: boolean
  onSelectDex: (dex: DexType) => void
}

export function DexAggregator({
  fromToken,
  toToken,
  amount,
  quotes,
  selectedDex,
  isLoading,
  onSelectDex,
}: DexAggregatorProps) {
  const [sortedQuotes, setSortedQuotes] = useState<DexQuote[]>([])
  const [bestDex, setBestDex] = useState<DexType | null>(null)

  useEffect(() => {
    if (quotes && quotes.length > 0) {
      // Sort quotes by output amount (descending)
      const sorted = [...quotes].sort((a, b) => {
        if (b.outputAmount.gt(a.outputAmount)) return 1
        if (b.outputAmount.lt(a.outputAmount)) return -1
        return 0
      })

      setSortedQuotes(sorted)
      setBestDex(sorted[0].dexInfo.id)

      // Auto-select best DEX if none is selected
      if (!selectedDex) {
        onSelectDex(sorted[0].dexInfo.id)
      }
    } else {
      setSortedQuotes([])
      setBestDex(null)
    }
  }, [quotes, selectedDex, onSelectDex])

  if (isLoading) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!quotes || quotes.length === 0) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-center p-4 text-gray-500">
            <AlertCircle className="mr-2 h-5 w-5" />
            <span>No quotes available</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full mt-4">
      <CardContent className="p-4">
        <div className="mb-2 text-sm font-medium text-gray-500">Available DEX Options</div>

        <div className="space-y-2">
          {sortedQuotes.map((quote) => {
            const { dexInfo, outputAmount, priceImpact } = quote
            const isBest = dexInfo.id === bestDex
            const isSelected = dexInfo.id === selectedDex

            return (
              <div
                key={dexInfo.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"
                } ${isBest ? "relative" : ""}`}
              >
                {isBest && (
                  <div className="absolute -top-2 -left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Best Rate
                  </div>
                )}

                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full mr-2" style={{ backgroundColor: dexInfo.color }} />
                  <div>
                    <div className="font-medium">
                      {dexInfo.name} {dexInfo.version}
                    </div>
                    <div className="text-xs text-gray-500">Price Impact: {priceImpact.toFixed(2)}%</div>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="text-right mr-3">
                    <div className="font-medium">{ethers.utils.formatUnits(outputAmount, 18)}</div>
                    <div className="text-xs text-gray-500">
                      {isBest
                        ? "+0.00%"
                        : `-${((1 - Number(outputAmount) / Number(sortedQuotes[0].outputAmount)) * 100).toFixed(2)}%`}
                    </div>
                  </div>

                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSelectDex(dexInfo.id)}
                    className={isSelected ? "bg-blue-500" : ""}
                  >
                    {isSelected ? <Check className="h-4 w-4" /> : "Select"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
