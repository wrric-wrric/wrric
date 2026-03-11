"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Section from "./Section";
import Layout from "./Layout";
import { sections } from "./sections";
import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const scrollPosition = containerRef.current.scrollTop;
        const windowHeight = window.innerHeight;
        const newActiveSection = Math.round(scrollPosition / windowHeight);
        setActiveSection(newActiveSection);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      handleScroll();
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const handleNavClick = (index: number) => {
    if (containerRef.current) {
      const windowHeight = window.innerHeight;
      containerRef.current.scrollTo({
        top: index * windowHeight,
        behavior: "smooth",
      });
    }
  };

  const handleExploreEvents = () => {
    router.push('/events');
  };

  return (
    <Layout>
      {/* Login Button (Top Right) */}
      <motion.div
        className="fixed top-4 right-4 z-50 flex items-center gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Link href="/auth/login">
          <motion.button
            className="px-6 py-2.5 rounded-full bg-[#1A1A1A]/80 backdrop-blur-sm border border-[#00FB75]/30 text-white font-medium hover:border-[#00FB75] hover:shadow-[0_0_15px_rgba(0,251,117,0.2)] transition-all duration-300 text-sm hidden sm:block"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign In
          </motion.button>
        </Link>

        {/* Mobile Menu Button */}
        <motion.button
          className="lg:hidden p-3 rounded-full bg-[#121212]/90 backdrop-blur-sm border border-[#1A1A1A] hover:border-[#00FB75]/50 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Navigation Dots */}
      <nav className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-6 p-4 hidden md:flex">
        {sections.map((section, index) => (
          <motion.button
            key={section.id}
            className={`relative transition-all duration-500`}
            onClick={() => handleNavClick(index)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          >
            <div className="flex items-center gap-4 group">
              <motion.span
                className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-primary transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 italic"
              >
                {section.id === 'hero' ? 'INIT' : section.id.toUpperCase()}
              </motion.span>
              <motion.div
                className={`w-2 h-2 rounded-full border transition-all duration-500 ${index === activeSection
                  ? "bg-primary border-primary shadow-[0_0_15px_rgba(0,251,117,0.5)] scale-125"
                  : "bg-transparent border-white/20 hover:border-primary/50"
                  }`}
              />
            </div>
          </motion.button>
        ))}
      </nav>

      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50 shadow-[0_0_15px_rgba(0,251,117,0.5)]"
        style={{ scaleX }}
      />

      {/* Main Content - scroll container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth relative z-10"
        style={{ scrollBehavior: 'smooth' }}
      >
        {sections.map((section, index) => (
          <React.Fragment key={section.id}>
            <Section
              {...section}
              isActive={index === activeSection}
              showGlobe={index === 0}
              onExploreEvents={handleExploreEvents}
            />
          </React.Fragment>
        ))}
      </div>
    </Layout>
  );
}
