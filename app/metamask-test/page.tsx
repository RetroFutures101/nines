import MetamaskTest from "@/components/web3/metamask-test"

export default function MetamaskTestPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <h1 className="text-2xl font-bold mb-6">MetaMask Connection Test</h1>
      <MetamaskTest />
    </main>
  )
}
