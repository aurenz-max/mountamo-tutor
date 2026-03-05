"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { RefreshCw, Loader2, AlertCircle, Filter } from "lucide-react";
import { useItemCalibrations } from "@/hooks/useItemCalibrations";
import type { ItemCalibration } from "@/types/calibration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convergenceColor(delta: number | undefined): string {
  if (delta === undefined) return "text-gray-500";
  if (delta < 0.5) return "text-green-600";
  if (delta < 1.5) return "text-yellow-600";
  return "text-red-600";
}

function convergenceBadge(delta: number | undefined): {
  label: string;
  className: string;
} {
  if (delta === undefined)
    return { label: "No data", className: "bg-gray-100 text-gray-700" };
  if (delta < 0.5)
    return { label: "Converged", className: "bg-green-100 text-green-800" };
  if (delta < 1.5)
    return { label: "Converging", className: "bg-yellow-100 text-yellow-800" };
  return { label: "Divergent", className: "bg-red-100 text-red-800" };
}

function accuracyPct(item: ItemCalibration): string {
  if (item.total_observations === 0) return "—";
  return `${Math.round((item.total_correct / item.total_observations) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Credibility distribution chart data
// ---------------------------------------------------------------------------

function buildCredibilityDistribution(items: ItemCalibration[]) {
  const buckets = [
    { range: "0–0.25", min: 0, max: 0.25, count: 0 },
    { range: "0.25–0.5", min: 0.25, max: 0.5, count: 0 },
    { range: "0.5–0.75", min: 0.5, max: 0.75, count: 0 },
    { range: "0.75–1.0", min: 0.75, max: 1.01, count: 0 },
  ];
  for (const item of items) {
    for (const bucket of buckets) {
      if (item.credibility_z >= bucket.min && item.credibility_z < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }
  return buckets;
}

const BUCKET_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ItemCalibrationPanel() {
  const [primitiveFilter, setPrimitiveFilter] = useState<string | undefined>(
    undefined,
  );
  const { data, loading, error, refetch } =
    useItemCalibrations(primitiveFilter);

  // Extract unique primitive types for filter
  const primitiveTypes = data
    ? Array.from(new Set(data.items.map((i) => i.primitive_type))).sort()
    : [];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-500">Loading calibration data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-gray-500">
            Could not load calibration data
          </span>
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];
  const credDist = buildCredibilityDistribution(items);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Items</p>
            <p className="text-2xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Fully Credible (Z=1.0)</p>
            <p className="text-2xl font-bold text-green-600">
              {items.filter((i) => i.credibility_z >= 0.99).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Observations</p>
            <p className="text-2xl font-bold">
              {items
                .reduce((s, i) => s + i.total_observations, 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Avg Convergence Delta</p>
            <p
              className={`text-2xl font-bold ${convergenceColor(
                items.length > 0
                  ? items.reduce(
                      (s, i) => s + (i.convergence_delta ?? 0),
                      0,
                    ) / items.length
                  : undefined,
              )}`}
            >
              {items.length > 0
                ? (
                    items.reduce(
                      (s, i) => s + (i.convergence_delta ?? 0),
                      0,
                    ) / items.length
                  ).toFixed(2)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credibility distribution chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credibility Distribution</CardTitle>
          <CardDescription>
            How many items are at each credibility level (Z = sqrt(n/200))
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={credDist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {credDist.map((_, idx) => (
                  <Cell key={idx} fill={BUCKET_COLORS[idx]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filter + table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Item Calibrations</CardTitle>
              <CardDescription>
                Per-item difficulty estimates with convergence status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                className="text-sm border rounded px-2 py-1"
                value={primitiveFilter ?? ""}
                onChange={(e) =>
                  setPrimitiveFilter(e.target.value || undefined)
                }
              >
                <option value="">All primitives</option>
                {primitiveTypes.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Primitive
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Mode
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">
                    Prior Beta
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">
                    Calibrated Beta
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">
                    Delta
                  </th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">
                    Credibility
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">
                    Obs
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">
                    Accuracy
                  </th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const badge = convergenceBadge(item.convergence_delta);
                  return (
                    <tr
                      key={item.item_key}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-2 font-medium">
                        {item.primitive_type}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {item.eval_mode}
                      </td>
                      <td className="text-right px-4 py-2">
                        {item.prior_beta.toFixed(1)}
                      </td>
                      <td className="text-right px-4 py-2 font-medium">
                        {item.calibrated_beta.toFixed(2)}
                      </td>
                      <td
                        className={`text-right px-4 py-2 font-medium ${convergenceColor(item.convergence_delta)}`}
                      >
                        {item.convergence_delta?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={item.credibility_z * 100}
                            className="h-2 w-16"
                          />
                          <span className="text-xs text-gray-500">
                            {(item.credibility_z * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-2 text-gray-600">
                        {item.total_observations}
                      </td>
                      <td className="text-right px-4 py-2 text-gray-600">
                        {accuracyPct(item)}
                      </td>
                      <td className="text-center px-4 py-2">
                        <Badge
                          variant="secondary"
                          className={badge.className}
                        >
                          {badge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No item calibration data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
