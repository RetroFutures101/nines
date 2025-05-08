import { Suspense } from "react"
import DEXInterface from "@/components/dex/dex-interface"
import LoadingSpinner from "@/components/ui/loading-spinner"
import CollapsibleNotification from "@/components/ui/collapsible-notification"
import InstructionPanel from "@/components/ui/instruction-panel"

export default function Home() {
  return (
    <main className="flex min-h-screen">
      <InstructionPanel />
      <div className="flex-1 flex flex-col items-center p-4 md:p-24">
        <Suspense fallback={<LoadingSpinner />}>
          <DEXInterface />
        </Suspense>
        <CollapsibleNotification />
      </div>
    </main>
  )
}
