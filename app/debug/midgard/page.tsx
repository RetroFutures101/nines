import MidgardAnalyzer from "@/components/debug/midgard-analyzer"

export default function MidgardDebugPage() {
  return (
    <main className="flex flex-col items-center p-4 md:p-8">
      <div className="max-w-4xl w-full space-y-4">
        <h1 className="text-2xl font-bold">Midgard Assets Debug</h1>
        <p className="text-muted-foreground">
          This page helps debug token logos and information extracted from Midgard assets.
        </p>

        <MidgardAnalyzer />
      </div>
    </main>
  )
}
