export function ActivityCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
      {/* Header with icon and category */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-5 bg-gray-200 rounded w-3/4" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
      </div>

      {/* Curriculum hierarchy */}
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>

      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-6 bg-gray-200 rounded-full w-16" />
        <div className="h-6 bg-gray-200 rounded-full w-20" />
        <div className="h-6 bg-gray-200 rounded-full w-24" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <div className="h-9 bg-gray-200 rounded flex-1" />
        <div className="h-9 bg-gray-200 rounded w-9" />
        <div className="h-9 bg-gray-200 rounded w-9" />
        <div className="h-9 bg-gray-200 rounded w-9" />
      </div>
    </div>
  );
}
