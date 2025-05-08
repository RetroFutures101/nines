"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getTokenLogoWithFallback } from "@/lib/token-icons"
import { useEffect } from "react"

interface RoutingDisplayProps {
  routes: {
    path: string[]
    percentage: number
    version: string
    pathDescription?: string
  }[]
  fromToken: any
  toToken: any
}

export default function RoutingDisplay({ routes, fromToken, toToken }: RoutingDisplayProps) {
  const [open, setOpen] = useState(false)
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({})

  // Load token logos
  useEffect(() => {
    const loadTokenLogos = async () => {
      const newLogoUrls: Record<string, string> = {}

      // Get unique token addresses from all paths
      const uniqueAddresses = new Set<string>()
      routes.forEach((route) => {
        route.path.forEach((address) => {
          uniqueAddresses.add(address)
        })
      })

      // Load logos for each unique address
      for (const address of uniqueAddresses) {
        try {
          // Create a minimal token object for the logo service
          const token = {
            address,
            symbol: "",
            name: "",
            decimals: 18,
          }

          const logoUrl = await getTokenLogoWithFallback(token)
          newLogoUrls[address] = logoUrl
        } catch (error) {
          console.error(`Failed to load logo for ${address}:`, error)
          newLogoUrls[address] = `/placeholder.svg?text=${address.substring(0, 4)}`
        }
      }

      setLogoUrls((prev) => ({ ...prev, ...newLogoUrls }))
    }

    if (routes.length > 0) {
      loadTokenLogos()
    }
  }, [routes])

  // If no routes, don't render anything
  if (!routes || routes.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
          View Routing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-black border border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Routing</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {routes.map((route, index) => (
            <div key={index} className="relative">
              <div className="flex items-center mb-1">
                <span className="text-green-500 font-bold">{route.percentage}%</span>
                <span className="ml-2 text-sm text-muted-foreground">{route.version}</span>
              </div>
              <div className="flex items-center">
                {route.path.map((address, pathIndex) => (
                  <div key={pathIndex} className="flex items-center">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={logoUrls[address] || `/placeholder.svg?text=${address.substring(0, 4)}`}
                        alt="Token"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {pathIndex < route.path.length - 1 && (
                      <div className="mx-2 text-muted-foreground">
                        <span className="text-xs tracking-widest">•••••••</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-2">
          <Button variant="outline" className="text-green-500 border-green-500 hover:bg-green-500/10">
            Customize Routing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
