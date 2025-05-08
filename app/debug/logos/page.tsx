import TokenLogoTester from "@/components/debug/token-logo-tester"

export default function TokenLogoDebugPage() {
  return (
    <main className="flex flex-col items-center p-4 md:p-8">
      <div className="max-w-4xl w-full space-y-4">
        <h1 className="text-2xl font-bold">Token Logo Debug</h1>
        <p className="text-muted-foreground">This page helps debug token logos from various sources.</p>

        <TokenLogoTester />
      </div>
    </main>
  )
}
