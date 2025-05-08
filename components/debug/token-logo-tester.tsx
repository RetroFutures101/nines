"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getTokenLogoAsync } from "@/lib/token-icons"
import { getPulseXLogoUrl } from "./simple-token-logo-service"
import { RefreshCw, Search } from "lucide-react"
import Image from "next/image"

export default function TokenLogoTester() {
  const [tokenAddress, setTokenAddress] = useState("")
  const [tokenSymbol, setTokenSymbol] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [pulseXUrl, setPulseXUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!tokenAddress) {
      setError("Please enter a token address")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get the direct PulseX URL
      const directPulseXUrl = getPulseXLogoUrl(tokenAddress)
      setPulseXUrl(directPulseXUrl)

      // Get the logo through our service
      const logo = await getTokenLogoAsync({
        address: tokenAddress,
        symbol: tokenSymbol || "????",
        name: "Unknown Token",
        decimals: 18,
      })

      setLogoUrl(logo)
    } catch (err) {
      console.error("Error fetching logo:", err)
      setError("Failed to fetch logo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Token Logo Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Token Address</label>
              <Input placeholder="0x..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Token Symbol (optional)</label>
              <Input placeholder="e.g. PLSX" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleLookup} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Lookup Logo
              </>
            )}
          </Button>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {logoUrl && (
            <div className="mt-6 p-4 bg-muted rounded-md">
              <h3 className="font-medium mb-4">Logo Result</h3>
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-black flex items-center justify-center">
                  <Image
                    src={logoUrl || "/placeholder.svg"}
                    alt="Token Logo"
                    width={64}
                    height={64}
                    className="object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = "/placeholder.svg?text=Error"
                    }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">URL:</p>
                  <p className="text-xs text-muted-foreground break-all">{logoUrl}</p>
                </div>
              </div>
            </div>
          )}

          {pulseXUrl && (
            <div className="mt-6 p-4 bg-muted rounded-md">
              <h3 className="font-medium mb-4">PulseX Direct URL</h3>
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-black flex items-center justify-center">
                  <Image
                    src={pulseXUrl || "/placeholder.svg"}
                    alt="PulseX Logo"
                    width={64}
                    height={64}
                    className="object-contain"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = "/placeholder.svg?text=Error"
                    }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">URL:</p>
                  <p className="text-xs text-muted-foreground break-all">{pulseXUrl}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-medium mb-2">Popular PulseChain Tokens</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenAddress("0xA1077a294dDE1B09bB078844df40758a5D0f9a27")
                  setTokenSymbol("WPLS")
                }}
              >
                WPLS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenAddress("0x95B303987A60C71504D99Aa1b13B4DA07b0790ab")
                  setTokenSymbol("PLSX")
                }}
              >
                PLSX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenAddress("0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39")
                  setTokenSymbol("HEX")
                }}
              >
                HEX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenAddress("0x9159f1D2a9f51998Fc9Ab03fbd8f265ab14A1b3B")
                  setTokenSymbol("LOAN")
                }}
              >
                LOAN
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenAddress("0xefD766cCb38EaF1dfd701853BFCe31359239F305")
                  setTokenSymbol("DAI")
                }}
              >
                DAI
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTokenAddress("0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07")
                  setTokenSymbol("USDC")
                }}
              >
                USDC
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
