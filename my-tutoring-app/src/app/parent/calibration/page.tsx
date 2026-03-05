"use client";

import React from "react";
import ItemCalibrationPanel from "@/components/admin/ItemCalibrationPanel";

export default function CalibrationAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Item Calibration Convergence
        </h1>
        <p className="text-gray-600 mt-1">
          Monitor how item difficulty estimates are converging from structural
          priors toward empirical values as students complete practice sessions.
        </p>
      </div>
      <ItemCalibrationPanel />
    </div>
  );
}
