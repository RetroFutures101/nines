"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { extractTokenLogosFromAssets, findAllTokensInAssets } from "@/lib/midgard-asset-parser"
import { fetchTokenLogoFromMidgard } from "@/lib/midgard-token-service"
import { scrapeTokenLogo, scrapeTokenInfo } from "@/lib/midgard-scraper"
import { RefreshCw, Search, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function MidgardAnalyzer() {
  const [tokenAddress, setTokenAddress] = useState("")
  const [results, setResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFindingAll, setIsFindingAll] = useState(false)
  const [allTokens, setAllTokens] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // Lookup a specific token
  const handleLookupToken = async () => {
    if (!tokenAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // Normalize the address
      const normalizedAddress = tokenAddress.toLowerCase()
      console.log(`Looking up token: ${normalizedAddress}`)

      // First try to get logo from assets
      const assetLogo = await extractTokenLogosFromAssets(normalizedAddress)

      // Then try the main Midgard service
      const midgardLogo = await fetchTokenLogoFromMidgard(normalizedAddress)

      // Try the new scraper
      const scrapedLogo = await scrapeTokenLogo(normalizedAddress)

      // Try to get token info from scraper
      const tokenInfo = await scrapeTokenInfo(normalizedAddress)

      setResults({
        address: normalizedAddress,
        assetLogo,
        midgardLogo,
        scrapedLogo,
        tokenInfo,
      })
    } catch (error) {
      console.error("Error looking up token:", error)
      setError(`Failed to lookup token: ${error instanceof Error ? error.message : String(error)}`)
      setResults(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Find all tokens in assets
  const handleFindAllTokens = async () => {
    setIsFindingAll(true)
    setError(null)

    try {
      const tokens = await findAllTokensInAssets()
      setAllTokens(tokens)

      if (tokens.length === 0) {
        setError(
          "No tokens found in Midgard assets. This could be due to CORS issues or changes in the asset structure.",
        )
      }
    } catch (error) {
      console.error("Error finding all tokens:", error)
      setError(`Failed to find tokens: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsFindingAll(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Midgard Asset Analyzer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Token Lookup */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Token Lookup</h3>
            <div className="flex space-x-2">
              <Input
                placeholder="Enter token address"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
              />
              <Button onClick={handleLookupToken} disabled={isLoading}>
                {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Lookup
              </Button>
            </div>

            {results && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <h4 className="font-medium mb-2">Results for {results.address}</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">Asset Logo:</p>
                    {results.assetLogo ? (
                      <div className="flex items-center">
                        <img
                          src={results.assetLogo || "/placeholder.svg"}
                          alt="Asset Logo"
                          className="h-8 w-8 rounded-full mr-2"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "/placeholder.svg?text=Error"
                          }}
                        />
                        <a
                          href={results.assetLogo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline truncate max-w-xs"
                        >
                          {results.assetLogo}
                        </a>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Not found</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium">Midgard Logo:</p>
                    {results.midgardLogo ? (
                      <div className="flex items-center">
                        <img
                          src={results.midgardLogo || "/placeholder.svg"}
                          alt="Midgard Logo"
                          className="h-8 w-8 rounded-full mr-2"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "/placeholder.svg?text=Error"
                          }}
                        />
                        <a
                          href={results.midgardLogo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline truncate max-w-xs"
                        >
                          {results.midgardLogo}
                        </a>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Not found</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium">Scraped Logo:</p>
                    {results.scrapedLogo ? (
                      <div className="flex items-center">
                        <img
                          src={results.scrapedLogo || "/placeholder.svg"}
                          alt="Scraped Logo"
                          className="h-8 w-8 rounded-full mr-2"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "/placeholder.svg?text=Error"
                          }}
                        />
                        <a
                          href={results.scrapedLogo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline truncate max-w-xs"
                        >
                          {results.scrapedLogo}
                        </a>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Not found</p>
                    )}
                  </div>

                  {results.tokenInfo && (
                    <div>
                      <p className="text-sm font-medium">Token Info:</p>
                      <div className="text-sm">
                        <p>Name: {results.tokenInfo.name || "N/A"}</p>
                        <p>Symbol: {results.tokenInfo.symbol || "N/A"}</p>
                        {results.tokenInfo.logoUrl && (
                          <div className="flex items-center mt-1">
                            <span className="mr-2">Logo:</span>
                            <img
                              src={results.tokenInfo.logoUrl || "/placeholder.svg"}
                              alt="Token Logo"
                              className="h-6 w-6 rounded-full mr-2"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src = "/placeholder.svg?text=Error"
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Find All Tokens */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">All Tokens in Assets</h3>
              <Button onClick={handleFindAllTokens} disabled={isFindingAll} variant="outline">
                {isFindingAll ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Find All Tokens
              </Button>
            </div>

            {allTokens.length > 0 && (
              <div className="mt-4">
                <p className="text-sm mb-2">Found {allTokens.length} tokens in Midgard assets</p>
                <ScrollArea className="h-60 w-full">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left p-2">Symbol</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTokens.map((token, index) => (
                        <tr key={index} className="border-b border-muted-foreground/20">
                          <td className="p-2">{token.symbol || "N/A"}</td>
                          <td className="p-2">{token.name || "N/A"}</td>
                          <td className="p-2 font-mono text-xs truncate max-w-[200px]">{token.address || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
