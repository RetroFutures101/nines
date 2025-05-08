"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Save, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface EnvVariablesProps {
  onSave: (variables: { rpcUrl: string; routerAddress: string; wplsAddress: string }) => void
}

export default function EnvVariables({ onSave }: EnvVariablesProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [rpcUrl, setRpcUrl] = useState("")
  const [routerAddress, setRouterAddress] = useState("")
  const [wplsAddress, setWplsAddress] = useState("")

  // Load saved values from localStorage on mount
  useEffect(() => {
    const savedRpcUrl = localStorage.getItem("rpcUrl")
    const savedRouterAddress = localStorage.getItem("routerAddress")
    const savedWplsAddress = localStorage.getItem("wplsAddress")

    if (savedRpcUrl) setRpcUrl(savedRpcUrl)
    if (savedRouterAddress) setRouterAddress(savedRouterAddress)
    if (savedWplsAddress) setWplsAddress(savedWplsAddress)
  }, [])

  const handleSave = () => {
    // Validate inputs
    if (!rpcUrl) {
      toast({
        title: "RPC URL Required",
        description: "Please enter a valid RPC URL",
        variant: "destructive",
      })
      return
    }

    if (!routerAddress || !routerAddress.startsWith("0x")) {
      toast({
        title: "Invalid Router Address",
        description: "Please enter a valid Ethereum address starting with 0x",
        variant: "destructive",
      })
      return
    }

    if (!wplsAddress || !wplsAddress.startsWith("0x")) {
      toast({
        title: "Invalid WPLS Address",
        description: "Please enter a valid Ethereum address starting with 0x",
        variant: "destructive",
      })
      return
    }

    // Save to localStorage
    localStorage.setItem("rpcUrl", rpcUrl)
    localStorage.setItem("routerAddress", routerAddress)
    localStorage.setItem("wplsAddress", wplsAddress)

    // Notify parent component
    onSave({ rpcUrl, routerAddress, wplsAddress })

    // Show success toast
    toast({
      title: "Settings Saved",
      description: "Your environment variables have been updated",
    })

    // Close the settings panel
    setIsOpen(false)
  }

  const handleReset = () => {
    // Default values
    const defaultRpcUrl = "https://rpc-pulsechain.g4mm4.io"
    const defaultRouterAddress = "0x165C3410fC91EF562C50559f7d2289fEbed552d9"
    const defaultWplsAddress = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27"

    setRpcUrl(defaultRpcUrl)
    setRouterAddress(defaultRouterAddress)
    setWplsAddress(defaultWplsAddress)

    // Save defaults to localStorage
    localStorage.setItem("rpcUrl", defaultRpcUrl)
    localStorage.setItem("routerAddress", defaultRouterAddress)
    localStorage.setItem("wplsAddress", defaultWplsAddress)

    // Notify parent component
    onSave({
      rpcUrl: defaultRpcUrl,
      routerAddress: defaultRouterAddress,
      wplsAddress: defaultWplsAddress,
    })

    toast({
      title: "Settings Reset",
      description: "Environment variables have been reset to defaults",
    })
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="icon" onClick={() => setIsOpen(true)} className="h-8 w-8">
        <Settings className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Environment Settings</CardTitle>
        <CardDescription>Configure the RPC URL and contract addresses used by the application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rpcUrl">RPC URL</Label>
          <Input
            id="rpcUrl"
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            placeholder="https://rpc-pulsechain.g4mm4.io"
          />
          <p className="text-xs text-muted-foreground">The RPC endpoint used to connect to the PulseChain network</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="routerAddress">Router Address</Label>
          <Input
            id="routerAddress"
            value={routerAddress}
            onChange={(e) => setRouterAddress(e.target.value)}
            placeholder="0x165C3410fC91EF562C50559f7d2289fEbed552d9"
          />
          <p className="text-xs text-muted-foreground">The PulseX Router contract address</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wplsAddress">WPLS Address</Label>
          <Input
            id="wplsAddress"
            value={wplsAddress}
            onChange={(e) => setWplsAddress(e.target.value)}
            placeholder="0xA1077a294dDE1B09bB078844df40758a5D0f9a27"
          />
          <p className="text-xs text-muted-foreground">The Wrapped PLS (WPLS) token contract address</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
