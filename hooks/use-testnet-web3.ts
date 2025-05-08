"use client"

import { useContext } from "react"
import { TestnetWeb3Context } from "@/components/web3/testnet-web3-provider"

export function useTestnetWeb3() {
  return useContext(TestnetWeb3Context)
}
