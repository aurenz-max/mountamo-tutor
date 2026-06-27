'use client';

export default function ExhibitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen">
      {/* Pre-paint dark base — sits behind the GenerativeBackground canvas
          (which is transparent until its first JS draw). Without this, the
          default-white <body> shows through during the route transition and
          flashes white. Mirrors the same -z-20 fallback the landing uses. */}
      <div aria-hidden className="fixed inset-0 -z-20 bg-slate-950" />
      <style jsx global>{`
        /* Custom scrollbar for Lumina */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        /* 3D transforms for cards */
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }

        /* Glass effect */
        .glass-panel {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(20px);
        }

        /* Fade animations */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
      `}</style>
      {children}
    </div>
  );
}
