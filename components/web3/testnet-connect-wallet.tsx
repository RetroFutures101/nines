"use client"

import { Button } from "@/components/ui/button"
import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"
import { Loader2, Wallet } from "lucide-react"

export default function TestnetConnectWallet() {
  const { isConnected, isConnecting, connect, disconnect, address } = useTestnetWeb3()

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  return (
    <>
      {isConnected ? (
        <Button
          variant="outline"
          onClick={disconnect}
          className="bg-[#1a1a1a] border-[#333] hover:bg-[#333] hover:text-white"
        >
          {formatAddress(address || "")}
        </Button>
      ) : (
        <Button
          onClick={connect}
          disabled={isConnecting}
          className="bg-[#ff0099] hover:bg-[#cc0077] text-white border-none"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </>
          )}
        </Button>
      )}
    </>
  )
}
