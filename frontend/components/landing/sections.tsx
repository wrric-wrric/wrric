import { Badge } from "@/components/ui/badge"

export const sections = [
  {
    id: 'hero',
    subtitle: (
      <Badge className="bg-primary/10 text-primary font-black text-[10px] uppercase tracking-[0.3em] px-4 py-2 border border-primary/20 backdrop-blur-3xl italic">
        DEPLOYMENT: GLOBAL CLIMATE NODE
      </Badge>
    ),
    title: "UNIFYING GLOBAL CAPITAL WITH AFRICAN INNOVATION",
    content: "Architecting the bridge between institutional investors and high-impact climate tech across Sub-Saharan Africa. Join the movement that's transforming the environmental landscape.",
    showButton: true,
    buttonText: 'INITIALIZE EXPLORATION',
    buttonLink: '/labs/map',
    showGlobe: true
  },
  {
    id: 'mission',
    subtitle: (
      <Badge className="bg-white/5 text-white font-black text-[10px] uppercase tracking-[0.3em] px-4 py-2 border border-white/10 backdrop-blur-3xl italic">
        STRATEGIC DIRECTIVE: IMPACT
      </Badge>
    ),
    title: "FROM GLOBAL NORTH TO EMERGING SOUTH",
    content: "Routing precise investment into Africa's most promising climate innovation corridors. We facilitate high-stakes partnerships that drive sustainable continental evolution.",
    showButton: true,
    buttonText: 'DEFINE IMPACT DATA',
    buttonLink: '/labs',
    showGlobe: false
  },
  {
    id: 'impact',
    subtitle: (
      <Badge className="bg-primary/5 text-primary/60 font-black text-[10px] uppercase tracking-[0.3em] px-4 py-2 border border-primary/10 backdrop-blur-3xl italic">
        PROTOCOL: SUSTAINABLE FUTURE
      </Badge>
    ),
    title: "POWERED BY PARTNERSHIP ARCHITECTURE",
    content: "Engineering connections that catalyze climate action and robust economic growth. Every strategic alliance reinforces the foundation of a sustainable tomorrow.",
    showButton: true,
    buttonText: 'ESTABLISH ALLIANCE',
    buttonLink: '/auth/register',
    showGlobe: false
  },
  {
    id: 'events',
    subtitle: (
      <Badge className="bg-white/5 text-white font-black text-[10px] uppercase tracking-[0.3em] px-4 py-2 border border-white/10 backdrop-blur-3xl italic">
        TEMPORAL MARKER: UPCOMING PHASES
      </Badge>
    ),
    title: "CLIMATE INTELLIGENCE NETWORKS",
    content: "Engage with hackathons, innovation summits, and tactical challenges bringing together climate tech visionaries, global investors, and regional innovators.",
    showButton: true,
    buttonText: 'SCAN GLOBAL EVENTS',
    buttonLink: '/events',
    showGlobe: false,
    isEvents: true
  },
  {
    id: 'cta',
    subtitle: (
      <Badge className="bg-primary/20 text-primary font-black text-[10px] uppercase tracking-[0.4em] px-6 py-2 border border-primary/50 backdrop-blur-3xl italic animate-pulse">
        SYSTEM STATUS: READY FOR UPLINK
      </Badge>
    ),
    title: "INITIATE YOUR MISSION IMPACT",
    content: "Join the consortium of innovators, investors, and climate champions architecting the African sustainable future. Your neural integration starts here.",
    showButton: true,
    buttonText: 'JOIN THE CONSORTIUM',
    buttonLink: '/auth/register',
    showGlobe: false,
    isCTA: true
  }
]
