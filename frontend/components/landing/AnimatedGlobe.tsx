"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { geoOrthographic, geoPath, geoCentroid, GeoPermissibleObjects } from "d3-geo";

type GeoJSONAny = GeoPermissibleObjects;

const DEFAULT_COLOR = { 
  glow: "rgba(0,251,117,0.08)", 
  outline: "rgba(0,251,117,0.35)", 
  africaFill: "rgba(0,251,117,0.25)", 
  africaOutline: "rgba(0,251,117,0.9)", 
  connection: "rgba(0,251,117,0.4)", 
  dot: "rgba(255,77,0," 
};

const BUILTIN_AFRICA: GeoJSON.FeatureCollection = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { name: "Africa (fallback)" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [ -17.5, 37.0 ],
            [ 51.5, 37.0 ],
            [ 51.5, -34.5 ],
            [ -34.8, -34.5 ],
            [ -17.5, 37.0 ]
          ]
        ]
      }
    }
  ]
};

export default function AnimatedGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const africaGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const connectionsRef = useRef<any[]>([]);
  const starsRef = useRef<any[]>([]);

  // Enhanced star generation
  const generateStars = (count: number, width: number, height: number) => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speed: 0.2 + Math.random() * 0.4,
      brightness: 0.3 + Math.random() * 0.7,
      twinkleSpeed: Math.random() * 0.05,
      twinklePhase: Math.random() * Math.PI * 2
    }));
  };

  const loadAfricaGeo = async () => {
    try {
      const res = await fetch("/maps/africa.geojson");
      if (!res.ok) throw new Error("No africa.geojson found");
      const geo = await res.json();
      if (geo && geo.type && geo.features) {
        africaGeoRef.current = geo;
        return;
      }
      throw new Error("Invalid geojson");
    } catch (err) {
      africaGeoRef.current = BUILTIN_AFRICA;
    }
  };

  useEffect(() => {
    let mounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    loadAfricaGeo();

    const DPR = Math.max(1, window.devicePixelRatio || 1);

    const resizeCanvas = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      
      // Regenerate stars on resize
      starsRef.current = generateStars(300, w, h);
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // INCREASED GLOBE SIZE: Changed from 0.2 to 0.28 (40% larger)
    const globe = {
      cx: canvas.width / DPR * 0.7,
      cy: canvas.height / DPR * 0.5,
      radius: Math.min(canvas.width / DPR, canvas.height / DPR) * 0.28, // Increased size
      rotation: 0
    };

    const projection = geoOrthographic()
      .scale(globe.radius)
      .translate([globe.cx, globe.cy])
      .clipAngle(90);

    const pathGenerator = geoPath().projection(projection).context(ctx);

    const generateConnectionPoints = (n = 22) => { // More connections for larger globe
      const pts: any[] = [];
      for (let i = 0; i < n; i++) {
        const lon = Math.random() * 360 - 180;
        const lat = Math.random() * 140 - 70;
        pts.push({
          lon,
          lat,
          progress: Math.random(),
          speed: 0.15 + Math.random() * 0.35,
          size: 2 + Math.random() * 4, // Slightly larger dots
          pulse: Math.random() * Math.PI * 2
        });
      }
      return pts;
    };

    connectionsRef.current = generateConnectionPoints();

    const updateProjection = () => {
      projection
        .scale(globe.radius)
        .translate([globe.cx, globe.cy])
        .rotate([-globe.rotation, 0, 0]);
      pathGenerator.projection(projection);
    };

    let africaCentroid: [number, number] | null = null;
    const computeAfricaCentroid = () => {
      try {
        if (!africaGeoRef.current) return null;
        africaCentroid = geoCentroid(africaGeoRef.current as any) as [number, number];
      } catch (err) {
        africaCentroid = null;
      }
    };

    setTimeout(() => {
      computeAfricaCentroid();
    }, 250);

    const animate = () => {
      if (!mounted) return;
      
      // Clear with dark gradient for space effect
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height / DPR);
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);

      // Enhanced starfield animation
      starsRef.current.forEach(star => {
        star.x -= star.speed;
        star.twinklePhase += star.twinkleSpeed;
        
        if (star.x < -10) {
          star.x = canvas.width / DPR + 10;
          star.y = Math.random() * canvas.height / DPR;
        }

        // Twinkling effect
        const twinkle = 0.7 + 0.3 * Math.sin(star.twinklePhase);
        const brightness = star.brightness * twinkle;

        // Star glow effect
        const glowGradient = ctx.createRadialGradient(
          star.x, star.y, 0, 
          star.x, star.y, star.size * 3
        );
        glowGradient.addColorStop(0, `rgba(255, 255, 255, ${brightness})`);
        glowGradient.addColorStop(0.3, `rgba(255, 255, 255, ${brightness * 0.3})`);
        glowGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Star core
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Update globe size and position
      globe.cx = (canvas.width / DPR) * 0.7;
      globe.cy = (canvas.height / DPR) * 0.5;
      globe.radius = Math.min(canvas.width / DPR, canvas.height / DPR) * 0.28; // Consistent larger size

      updateProjection();

      // Enhanced globe glow
      const grd = ctx.createRadialGradient(
        globe.cx, globe.cy, 0, 
        globe.cx, globe.cy, globe.radius * 1.6
      );
      grd.addColorStop(0, DEFAULT_COLOR.glow);
      grd.addColorStop(0.5, "rgba(0,251,117,0.04)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(globe.cx, globe.cy, globe.radius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Globe outline with glow
      ctx.strokeStyle = DEFAULT_COLOR.outline;
      ctx.lineWidth = 2; // Thicker outline for larger globe
      ctx.beginPath();
      ctx.arc(globe.cx, globe.cy, globe.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Africa with enhanced styling
      if (africaGeoRef.current) {
        try {
          // Africa fill with subtle gradient
          ctx.save();
          const africaGradient = ctx.createRadialGradient(
            globe.cx, globe.cy, 0, 
            globe.cx, globe.cy, globe.radius
          );
          africaGradient.addColorStop(0, "rgba(0,251,117,0.3)");
          africaGradient.addColorStop(1, "rgba(0,251,117,0.15)");
          
          ctx.fillStyle = africaGradient;
          ctx.beginPath();
          pathGenerator(africaGeoRef.current as any);
          ctx.fill();

          // Enhanced Africa outline
          ctx.strokeStyle = DEFAULT_COLOR.africaOutline;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          pathGenerator(africaGeoRef.current as any);
          ctx.stroke();
          ctx.restore();
        } catch (err) {
          // Fallback drawing
        }
      }

      let africaPointXY: [number, number] | null = null;
      if (africaCentroid) {
        try {
          const p = projection(africaCentroid as any);
          if (p) africaPointXY = [p[0], p[1]];
        } catch (err) {
          africaPointXY = null;
        }
      }
      if (!africaPointXY) {
        africaPointXY = [globe.cx - globe.radius * 0.1, globe.cy - globe.radius * 0.1];
      }

      // Enhanced connection animations
      connectionsRef.current.forEach(pt => {
        pt.progress += pt.speed / 100;
        pt.pulse += 0.06;
        if (pt.progress > 1) pt.progress = 0;

        const src = projection([pt.lon, pt.lat]);
        if (!src) return;
        const srcX = src[0];
        const srcY = src[1];

        const targetX = africaPointXY![0];
        const targetY = africaPointXY![1];

        const t = pt.progress;
        const midX = srcX + (targetX - srcX) * t + Math.sin(t * Math.PI) * globe.radius * 0.1;
        const midY = srcY + (targetY - srcY) * t - Math.cos(t * Math.PI) * globe.radius * 0.03;

        // Enhanced connection lines with gradient
        const lineGradient = ctx.createLinearGradient(srcX, srcY, midX, midY);
        lineGradient.addColorStop(0, `rgba(0,251,117,${0.5 * (1 - t)})`);
        lineGradient.addColorStop(1, `rgba(255,77,0,${0.3 * (1 - t)})`);
        
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(srcX, srcY);
        const cpx = srcX + (targetX - srcX) * 0.5 + Math.sin(t * Math.PI) * globe.radius * 0.08;
        const cpy = srcY + (targetY - srcY) * 0.5 - Math.cos(t * Math.PI) * globe.radius * 0.04;
        ctx.quadraticCurveTo(cpx, cpy, midX, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Enhanced traveling dot with glow
        const pulseSize = pt.size * (0.9 + 0.4 * Math.sin(pt.pulse));
        const dotGradient = ctx.createRadialGradient(midX, midY, 0, midX, midY, pulseSize * 2);
        dotGradient.addColorStop(0, `rgba(255, 255, 255, ${Math.max(0.3, 1 - t * 0.6)})`);
        dotGradient.addColorStop(0.7, `rgba(255,77,0,${Math.max(0.2, 0.8 - t * 0.6)})`);
        dotGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = dotGradient;
        ctx.beginPath();
        ctx.arc(midX, midY, pulseSize * 2, 0, Math.PI * 2);
        ctx.fill();

        // Dot core
        ctx.fillStyle = `rgba(255,77,0,${Math.max(0.4, 1 - t * 0.5)})`;
        ctx.beginPath();
        ctx.arc(midX, midY, pulseSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      globe.rotation = (globe.rotation + 0.06) % 360; // Slightly slower rotation for larger globe

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      className="absolute inset-0 z-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
    />
  );
}