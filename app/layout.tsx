import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Web3Provider } from "@/components/web3/web3-provider"
import { TokenProvider } from "@/lib/contexts/token-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PulseChain DEX",
  description: "Decentralized Exchange for PulseChain",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Web3Provider>
            <TokenProvider>{children}</TokenProvider>
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  )
}
