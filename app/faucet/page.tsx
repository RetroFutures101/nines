import { Suspense } from "react"
import FaucetInterface from "@/components/faucet/faucet-interface"
import LoadingSpinner from "@/components/ui/loading-spinner"
import CookieConsent from "@/components/ui/cookie-consent"
import { TestnetWeb3Provider } from "@/components/web3/testnet-web3-provider"
import { TokenProvider } from "@/lib/contexts/token-context"
import InstructionPanel from "@/components/ui/instruction-panel"

export default function FaucetPage() {
  return (
    <main className="flex min-h-screen">
      <InstructionPanel />
      <div className="flex-1 flex flex-col items-center p-4 md:p-24">
        <TestnetWeb3Provider>
          <TokenProvider isTestnet={true}>
            <Suspense fallback={<LoadingSpinner />}>
              <FaucetInterface />
            </Suspense>
          </TokenProvider>
        </TestnetWeb3Provider>
        <CookieConsent />
      </div>
    </main>
  )
}
