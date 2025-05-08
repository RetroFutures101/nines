"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTestnetWeb3 } from "@/hooks/use-testnet-web3"
import TestnetConnectWallet from "../web3/testnet-connect-wallet"
import NetworkToggle from "../ui/network-toggle"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

export default function FaucetInterface() {
  const { isConnected, address } = useTestnetWeb3()
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Card className="w-full max-w-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-[#333]">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="mr-3">
              <Image
                src="https://img.cryptorank.io/coins/pulse_x1684486367385.png"
                alt="PulseX Logo"
                width={40}
                height={40}
                className="rounded-full"
              />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-[#ff0099] to-[#ff66cc] text-transparent bg-clip-text">
              PulseX FAUCET
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {/* Pass isOnFaucetPage prop to NetworkToggle */}
            <NetworkToggle isOnFaucetPage={true} />
            <TestnetConnectWallet />
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <Link href="/testnet" passHref>
            <Button variant="outline" className="flex items-center space-x-1">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Testnet
            </Button>
          </Link>
        </div>

        <div className="bg-[#111] p-6 rounded-lg border border-[#333] mb-6">
          <h3 className="text-xl font-bold mb-4">PulseChain Testnet Faucet</h3>
          <p className="mb-4">
            This faucet allows you to request test PLS (tPLS) tokens for development and testing on the PulseChain
            Testnet.
          </p>

          <div className="mb-6">
            <h4 className="font-medium mb-2">How to use:</h4>
            <ol className="list-decimal list-inside space-y-2">
              <li>Connect your wallet to the PulseChain Testnet</li>
              <li>Request tPLS tokens from the faucet</li>
              <li>Use the tokens for testing on the PulseChain Testnet</li>
            </ol>
          </div>

          <div className="flex justify-center">
            <a
              href="https://pulsechain-testnet-v4-faucet.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button className="bg-[#ff0099] hover:bg-[#cc0077] text-white flex items-center">
                Open PulseChain Faucet
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>

        <div className="bg-[#111] p-4 rounded-lg border border-[#333]">
          <h4 className="font-medium mb-2">Note:</h4>
          <p className="text-sm text-muted-foreground">
            Tokens received from the PulseChain Testnet Faucet are for testing purposes only and have no real value.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
