"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import AnimatedGlobe from "./AnimatedGlobe"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface SectionProps {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  content?: string;
  isActive?: boolean;
  showButton?: boolean;
  buttonText?: string;
  buttonLink?: string;
  showGlobe?: boolean;
  onExploreEvents?: () => void;
  isEvents?: boolean;
  isCTA?: boolean;
}

interface ExtendedSectionProps extends SectionProps {
  showGlobe?: boolean;
  onExploreEvents?: () => void;
  isEvents?: boolean;
  isCTA?: boolean;
}

const FLOATING_PARTICLES_POSITIONS = [
  { left: "15%", top: "20%" },
  { left: "85%", top: "30%" },
  { left: "25%", top: "80%" },
  { left: "75%", top: "15%" },
  { left: "45%", top: "90%" },
  { left: "90%", top: "70%" },
  { left: "10%", top: "50%" },
  { left: "60%", top: "10%" }
];

function MiniGlobe({ isActive }: { isActive: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative z-0 opacity-0 hidden md:block">
        <div className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
          <div className="absolute inset-0 rounded-full border-2 border-[#00FB75] opacity-30" />
          <div className="absolute inset-4 rounded-full border border-[#FF4D00] opacity-60" />
          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-gray-900 to-black border border-gray-800">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <svg width="100" height="100" viewBox="0 0 100 100" className="opacity-70 hidden md:block">
                <path
                  d="M30,40 L45,35 L65,45 L70,60 L60,75 L40,80 L25,70 L20,55 Z"
                  fill="rgba(0, 251, 117, 0.2)"
                  stroke="rgba(0, 251, 117, 0.8)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="relative z-0 hidden md:block"
      initial={{ opacity: 0, scale: 0.8, x: 100 }}
      animate={isActive ? { opacity: 1, scale: 1, x: 0 } : {}}
      transition={{ duration: 1, delay: 0.5 }}
    >
      <div className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[#00FB75]"
          animate={{ scale: [1, 1.02, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute inset-4 rounded-full border border-[#FF4D00] opacity-60"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />

        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-gray-900 to-black border border-gray-800 shadow-2xl">
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="100" height="100" viewBox="0 0 100 100" className="opacity-70 hidden md:block">
              <path
                d="M30,40 L45,35 L65,45 L70,60 L60,75 L40,80 L25,70 L20,55 Z"
                fill="rgba(0, 251, 117, 0.2)"
                stroke="rgba(0, 251, 117, 0.8)"
                strokeWidth="1.5"
              />
            </svg>
          </motion.div>

          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-[#FF4D00] rounded-full hidden md:block"
              style={{
                left: `${20 + Math.cos(i * 1.047) * 30}%`,
                top: `${50 + Math.sin(i * 1.047) * 30}%`,
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        {FLOATING_PARTICLES_POSITIONS.map((position, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#00FB75] rounded-full hidden md:block"
            style={position}
            animate={{ y: [0, -20, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 4, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function NetworkVisualization({ isActive }: { isActive: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative z-0 opacity-0 hidden md:block">
        <div className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-[#00FB75] to-[#00e065]" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="relative z-0 hidden md:block"
      initial={{ opacity: 0, scale: 0.8, x: 100 }}
      animate={isActive ? { opacity: 1, scale: 1, x: 0 } : {}}
      transition={{ duration: 1, delay: 0.5 }}
    >
      <div className="relative w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-[#00FB75] to-[#00e065] shadow-lg shadow-[#00FB75]/30"
          animate={{ scale: [1, 1.1, 1], boxShadow: ["0 0 20px rgba(0, 251, 117, 0.3)", "0 0 40px rgba(0, 251, 117, 0.5)", "0 0 20px rgba(0, 251, 117, 0.3)"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-2 rounded-full border-2 border-white/30" />
        </motion.div>

        {[
          { angle: 0, distance: 120, delay: 0 },
          { angle: 60, distance: 140, delay: 0.2 },
          { angle: 120, distance: 130, delay: 0.4 },
          { angle: 180, distance: 150, delay: 0.6 },
          { angle: 240, distance: 125, delay: 0.8 },
          { angle: 300, distance: 135, delay: 1.0 },
        ].map((node, i) => (
          <motion.div
            key={i}
            className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-[#FF4D00] to-[#ff6a33] shadow-lg shadow-[#FF4D00]/30 hidden md:block"
            style={{
              left: `calc(50% + ${Math.cos(node.angle * Math.PI / 180) * node.distance}px)`,
              top: `calc(50% + ${Math.sin(node.angle * Math.PI / 180) * node.distance}px)`,
            }}
            initial={{ scale: 0 }}
            animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 2, delay: node.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#FF4D00] hidden md:block"
              animate={{ scale: [1, 2, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        ))}

        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute h-0.5 bg-gradient-to-r from-[#00FB75] to-[#FF4D00] origin-left hidden md:block"
            style={{
              left: '50%',
              top: '50%',
              width: '140px',
              transform: `rotate(${angle}deg)`,
              transformOrigin: 'left center',
            }}
            initial={{ scaleX: 0 }}
            animate={isActive ? { scaleX: [0, 1, 0], opacity: [0, 0.8, 0] } : {}}
            transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function EventsVisualization({ isActive }: { isActive: boolean }) {
  const events = [
    { name: "Climate Hack", city: "Nairobi", date: "Mar 15", color: "#00FB75" },
    { name: "Green Tech", city: "Lagos", date: "Mar 22", color: "#FF4D00" },
    { name: "Innovation Summit", city: "Cape Town", date: "Apr 5", color: "#8B5CF6" },
    { name: "Clean Energy", city: "Accra", date: "Apr 12", color: "#EC4899" },
  ];

  return (
    <motion.div
      className="relative z-0"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isActive ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8, delay: 0.3 }}
    >
      <div className="flex flex-wrap justify-center gap-4 max-w-2xl mx-auto">
        {events.map((event, i) => (
          <motion.div
            key={i}
            className="bg-[#121212]/80 backdrop-blur-sm border border-[#1A1A1A] rounded-xl p-4 w-40 md:w-48 hover:border-[#00FB75]/50 transition-colors cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={isActive ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }} />
              <span className="text-xs text-gray-400">{event.date}</span>
            </div>
            <h4 className="font-bold text-white text-sm mb-1">{event.name}</h4>
            <p className="text-xs text-gray-500">{event.city}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CTAVisualization({ isActive }: { isActive: boolean }) {
  return (
    <motion.div
      className="relative z-0"
      initial={{ opacity: 0 }}
      animate={isActive ? { opacity: 1 } : {}}
      transition={{ duration: 1 }}
    >
      <div className="flex justify-center items-center gap-8">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="relative"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          >
            <motion.div
              className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#00FB75] to-[#00e065] flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            >
              <span className="text-2xl md:text-3xl">{i === 1 ? '🌍' : i === 2 ? '🚀' : '💡'}</span>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="absolute inset-0 flex items-center justify-center -z-10"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border border-dashed border-[#00FB75]/30" />
      </motion.div>
    </motion.div>
  );
}

export default function Section({
  id,
  title,
  subtitle,
  content,
  isActive,
  showButton,
  buttonText,
  buttonLink,
  showGlobe = false,
  onExploreEvents,
  isEvents = false,
  isCTA = false
}: ExtendedSectionProps) {
  const getVisualization = () => {
    switch (id) {
      case 'hero':
        return <AnimatedGlobe />;
      case 'mission':
        return <MiniGlobe isActive={isActive || false} />;
      case 'impact':
        return <NetworkVisualization isActive={isActive || false} />;
      case 'events':
        return <EventsVisualization isActive={isActive || false} />;
      case 'cta':
        return <CTAVisualization isActive={isActive || false} />;
      default:
        return <MiniGlobe isActive={isActive || false} />;
    }
  };

  return (
    <section
      id={id}
      className="relative h-auto min-h-screen w-full snap-start flex flex-col justify-center p-4 md:p-8 lg:p-12 xl:p-16 overflow-hidden"
    >
      {/* Full screen animated globe for hero section - positioned behind content */}
      {id === 'hero' && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <AnimatedGlobe />
        </div>
      )}

      {/* Mobile-only mini visualization positioned behind content */}
      {id === 'hero' && (
        <div className="md:hidden absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <div className="w-64 h-64 rounded-full border border-[#00FB75]" />
          </div>
        </div>
      )}

      {/* Content wrapper with proper z-index to appear above animations */}
      <div className="relative z-10 max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto md:mx-0 md:ml-auto lg:ml-20 text-center md:text-left">
        {subtitle && (
          <motion.div
            className="mb-4 md:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={isActive ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {subtitle}
          </motion.div>
        )}

        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-none tracking-tighter text-white mb-6 md:mb-8 uppercase italic"
          initial={{ opacity: 0, y: 30 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {title}
        </motion.h2>

        {content && (
          <motion.p
            className="text-[10px] sm:text-xs md:text-sm lg:text-base text-gray-400 mb-8 md:mb-10 leading-relaxed uppercase tracking-[0.2em] max-w-2xl mx-auto md:mx-0 font-medium"
            initial={{ opacity: 0, y: 30 }}
            animate={isActive ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.35 }}
          >
            {content}
          </motion.p>
        )}

        {showButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isActive ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center md:justify-start"
          >
            {buttonLink ? (
              <Link href={buttonLink}>
                <motion.button
                  className="w-full sm:w-auto px-10 py-5 bg-primary text-black font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-primary/90 transition-all duration-300 text-[11px] italic shadow-[0_0_30px_rgba(0,251,117,0.2)]"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {buttonText}
                </motion.button>
              </Link>
            ) : (
              <motion.button
                className="w-full sm:w-auto px-10 py-5 bg-primary text-black font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-primary/90 transition-all duration-300 text-[11px] italic shadow-[0_0_30px_rgba(0,251,117,0.2)]"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExploreEvents}
              >
                {buttonText}
              </motion.button>
            )}
            <motion.button
              className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-white/10 transition-all duration-300 text-[11px] italic backdrop-blur-3xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              SYSTEM STATUS: NOMINAL
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Desktop: Visualization on the right side (for non-hero sections) */}
      <div className="hidden md:block absolute right-0 top-1/2 transform -translate-y-1/2 pr-4 lg:pr-12 xl:pr-20 w-1/2 max-w-xl lg:max-w-2xl z-0">
        {id !== 'hero' && getVisualization()}
      </div>
    </section>
  )
}
