import Head from 'next/head';
// Removed: import styles from '../styles/Home.module.css';
import TideSimulation from '@/components/science/tides/TideSimulation'; // Using your updated path

export default function Home() {
  return (
    // Using utility classes for overall page structure (example assumes Tailwind/global styles)
    // Adjust classes based on your actual setup (e.g., background, padding)
    <div className="flex flex-col items-center min-h-screen">
      <Head>
        <title>Tides Simulation (Next.js + p5.js)</title>
        <meta name="description" content="Demonstration of Moon's effect on tides" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Main content area - uses flex-1 to take available space, padding, centered items */}
      <main className="flex flex-col items-center w-full flex-1 px-6 py-12 text-center"> {/* Added padding */}
        {/* Title styling */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4"> {/* Adjusted text size and margin */}
          Understanding Tides: Earth & Moon Interaction
        </h1>

        {/* Description styling */}
        <p className="text-lg md:text-xl mb-8"> {/* Adjusted text size and margin */}
          A visual demonstration using Next.js, React, and p5.js.
        </p>

        {/* Render the simulation component */}
        {/* Optional: Add margin or padding around the simulation if needed */}
        <div className="w-full max-w-7xl"> {/* Optional wrapper to control width */}
            <TideSimulation />
        </div>

      </main>

      {/* Footer styling - ensures it's at the bottom, has border, padding etc. */}
      <footer className="flex items-center justify-center w-full h-20 border-t mt-auto"> {/* Added mt-auto */}
         Powered by Imagination and Gravity
      </footer>
    </div>
  );
}