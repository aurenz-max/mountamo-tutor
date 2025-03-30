'use client';

import React from 'react';
import Link from 'next/link';

export default function SciencePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Science Simulations</h1>
      <div className="grid gap-4">
        <div className="border p-4 rounded shadow-sm hover:shadow-md cursor-pointer">
          <Link href="/science/gas">
            <div>
              <h2 className="text-xl font-semibold">Ideal Gas Law Simulation</h2>
              <p className="mt-2">Interactive visualization of gas behavior following PV=nRT</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}