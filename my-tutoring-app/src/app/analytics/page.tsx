import { Metadata } from "next"
import StudentAnalytics from "@/components/analytics/StudentAnalytics"

export const metadata: Metadata = {
  title: "Analytics | AI Tutor",
  description: "Student learning analytics and progress tracking",
}

export default function AnalyticsPage() {
  return (
    <main className="flex-1 p-6">
      <StudentAnalytics />
    </main>
  )
}