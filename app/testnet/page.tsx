import { Suspense } from "react"
import TestnetDEXInterface from "@/components/dex/testnet-dex-interface"
import LoadingSpinner from "@/components/ui/loading-spinner"
import CollapsibleNotification from "@/components/ui/collapsible-notification"
import { TestnetWeb3Provider } from "@/components/web3/testnet-web3-provider"
import { TokenProvider } from "@/lib/contexts/token-context"
import InstructionPanel from "@/components/ui/instruction-panel"

export default function TestnetPage() {
  return (
    <main className="flex min-h-screen">
      <InstructionPanel />
      <div className="flex-1 flex flex-col items-center p-4 md:p-24">
        <TestnetWeb3Provider>
          <TokenProvider isTestnet={true} key="testnet-token-provider">
            <Suspense fallback={<LoadingSpinner />}>
              <TestnetDEXInterface />
            </Suspense>
          </TokenProvider>
        </TestnetWeb3Provider>
        <CollapsibleNotification isTestnet={true} />
      </div>
    </main>
  )
}
