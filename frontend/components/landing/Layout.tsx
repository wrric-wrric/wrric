import { ReactNode } from 'react'
import { StarsBackground } from "./StarsBackground"

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#020617] relative">
      {/* Animated Stars Background */}
      <StarsBackground />

      {/* Enhanced Grid Overlay */}
      <div className="absolute inset-0 z-[5] opacity-20 pointer-events-none">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 z-[5] pointer-events-none bg-gradient-to-b from-[#020617]/50 via-transparent to-[#020617]/80" />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#06b6d4]/10 to-transparent z-[5] pointer-events-none blur-[100px]" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-[#8b5cf6]/10 to-transparent z-[5] pointer-events-none blur-[100px]" />

      {/* Main Content */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  )
}
