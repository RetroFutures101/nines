"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import TokenSelector from "./token-selector"
import type { Token } from "@/types/token"
import { useToast } from "@/hooks/use-toast"

interface LiquidityInterfaceProps {
  tokens: Token[]
}

export default function LiquidityInterface({ tokens }: LiquidityInterfaceProps) {
  const { toast } = useToast()
  const [tokenA, setTokenA] = useState<Token | null>(null)
  const [tokenB, setTokenB] = useState<Token | null>(null)
  const [amountA, setAmountA] = useState("")
  const [amountB, setAmountB] = useState("")

  const handleAddLiquidity = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Liquidity provision will be available in the next update.",
    })
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium">Token A</label>
          {tokenA && <span className="text-sm text-muted-foreground">Balance: {tokenA.balance || "0.00"}</span>}
        </div>
        <div className="flex space-x-2">
          <Input
            type="number"
            placeholder="0.00"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            className="flex-1"
          />
          <TokenSelector selectedToken={tokenA} onSelectToken={setTokenA} tokens={tokens} />
        </div>
      </div>

      <div className="flex justify-center">
        <div className="bg-muted rounded-full p-2">
          <Plus className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium">Token B</label>
          {tokenB && <span className="text-sm text-muted-foreground">Balance: {tokenB.balance || "0.00"}</span>}
        </div>
        <div className="flex space-x-2">
          <Input
            type="number"
            placeholder="0.00"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            className="flex-1"
          />
          <TokenSelector selectedToken={tokenB} onSelectToken={setTokenB} tokens={tokens} />
        </div>
      </div>

      <Button className="w-full" disabled={!tokenA || !tokenB || !amountA || !amountB} onClick={handleAddLiquidity}>
        Add Liquidity
      </Button>
    </div>
  )
}
