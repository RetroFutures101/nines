"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FlaskConical, Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useWeb3 } from "@/hooks/use-web3"
import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"

interface NetworkToggleProps {
  isOnFaucetPage?: boolean
}

export default function NetworkToggle({ isOnFaucetPage = false }: NetworkToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isTestnet, setIsTestnet] = useState(false)
  const { toast } = useToast()
  const mainnetWeb3 = useWeb3()
  const testnetWeb3 = useTestnetWeb3()

  // Set initial state based on current path
  useEffect(() => {
    setIsTestnet(pathname === "/testnet" || pathname === "/faucet" || isOnFaucetPage)
  }, [pathname, isOnFaucetPage])

  const handleToggle = () => {
    // Save current connection state before switching
    if (isTestnet) {
      // Switching from testnet to mainnet
      if (testnetWeb3.isConnected && testnetWeb3.address) {
        localStorage.setItem("lastConnectedAddress", testnetWeb3.address)
        localStorage.setItem("lastConnectedNetwork", "testnet")
        console.log("Saved testnet connection state:", testnetWeb3.address)
      }

      // Disconnect from testnet
      testnetWeb3.disconnect()
    } else {
      // Switching from mainnet to testnet
      if (mainnetWeb3.isConnected && mainnetWeb3.address) {
        localStorage.setItem("lastConnectedAddress", mainnetWeb3.address)
        localStorage.setItem("lastConnectedNetwork", "mainnet")
        console.log("Saved mainnet connection state:", mainnetWeb3.address)
      }

      // Disconnect from mainnet
      mainnetWeb3.disconnect()
    }

    if (isOnFaucetPage) {
      // If on faucet page, always navigate to the appropriate network page
      if (!isTestnet) {
        router.push("/testnet")
      } else {
        router.push("/")
      }
      return
    }

    const newValue = !isTestnet
    setIsTestnet(newValue)

    // Show a notification about the network change
    toast({
      title: `Switching to ${newValue ? "Testnet" : "Mainnet"}`,
      description: "You'll need to reconnect your wallet after switching networks.",
    })

    // Navigate to the appropriate page
    if (newValue) {
      router.push("/testnet")
    } else {
      router.push("/")
    }
  }

  return (
    <div className="flex items-center space-x-2 bg-[#1a1a1a] border border-[#333] rounded-full p-1">
      <Button
        variant={!isTestnet ? "default" : "ghost"}
        size="sm"
        className={`rounded-full flex items-center ${!isTestnet ? "bg-[#ff0099]" : "bg-transparent hover:bg-[#333]"}`}
        onClick={() => {
          if (isTestnet) handleToggle()
        }}
      >
        <Globe className="h-4 w-4 mr-1" />
        LIVE
      </Button>
      <Button
        variant={isTestnet ? "default" : "ghost"}
        size="sm"
        className={`rounded-full flex items-center ${isTestnet ? "bg-[#ff0099]" : "bg-transparent hover:bg-[#333]"}`}
        onClick={() => {
          if (!isTestnet) handleToggle()
        }}
      >
        <FlaskConical className="h-4 w-4 mr-1" />
        TEST
      </Button>
    </div>
  )
}
