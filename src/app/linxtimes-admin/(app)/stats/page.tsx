"use client";
import { useState, useEffect } from "react";
import { formatCentsCompact } from "@/lib/money";

export default function StatsPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  useEffect(() => {
    fetchCourses();
    fetchStats();
  }, []);

  const fetchCourses = async () => {
    const res = await fetch("/api/admin/courses");
    const data = await res.json();
    setCourses(data);
  };

  const fetchStats = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (selectedCourse) params.append("courseId", selectedCourse);

    const res = await fetch(`/api/admin/stats?${params}`);
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };

  const handleFilter = () => fetchStats();

  if (!stats) return <div className="p-6">Loading...</div>;

  const t = stats.totals;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="font-display text-4xl font-semibold text-foreground mb-2">Platform Stats</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-8">
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-2">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-black/10 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-2">End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded border border-black/10 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-2">Course</label>
          <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="rounded border border-black/10 px-3 py-2 text-sm">
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleFilter} disabled={loading} className="rounded bg-linx-green text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {loading ? "Loading..." : "Filter"}
          </button>
        </div>
      </div>

      {/* Total Earned - Big Display */}
      <div className="bg-gradient-to-br from-linx-green/10 to-linx-green/5 rounded-3xl p-8 mb-12 border border-linx-green/20">
        <div className="text-sm font-medium text-foreground/60 mb-2">TOTAL FEES EARNED</div>
        <div className="text-5xl font-bold text-linx-green">{formatCentsCompact(t.totalEarned)}</div>
      </div>

      {/* Fee Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <StatCard label="Online Booking Fees" value={formatCentsCompact(t.onlineBookingFees)} bg="bg-blue-50" accent="text-blue-600" />
        <StatCard label="In-Person Booking Fees" value={formatCentsCompact(t.inPersonBookingFees)} bg="bg-amber-50" accent="text-amber-600" />
        <StatCard label="Online Cancelled (Retained)" value={formatCentsCompact(t.onlineCancelledFees)} bg="bg-red-50" accent="text-red-600" />
        <StatCard label="In-Person Cancelled (Retained)" value={formatCentsCompact(t.inPersonCancelledFees)} bg="bg-orange-50" accent="text-orange-600" />
      </div>

      {/* Booking Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <CountCard label="Online Bookings" value={t.onlineBookings} />
        <CountCard label="In-Person Bookings" value={t.inPersonBookings} />
        <CountCard label="Cancelled Bookings" value={t.cancelBookings} />
      </div>

      {/* By Course Table */}
      <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Breakdown by Course</h2>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-black/[0.02] text-left text-xs uppercase tracking-wide text-foreground/60">
              <th className="px-4 py-4 font-semibold">Course</th>
              <th className="px-4 py-4 font-semibold text-right">Online Bookings</th>
              <th className="px-4 py-4 font-semibold text-right">Online Fees</th>
              <th className="px-4 py-4 font-semibold text-right">In-Person Bookings</th>
              <th className="px-4 py-4 font-semibold text-right">In-Person Fees</th>
              <th className="px-4 py-4 font-semibold text-right">Online Cancelled Fees</th>
              <th className="px-4 py-4 font-semibold text-right">In-Person Cancelled Fees</th>
              <th className="px-4 py-4 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map((r: any, idx: number) => {
              const rowTotal = r.onlineBookingFees + r.inPersonBookingFees + r.onlineCancelledFees + r.inPersonCancelledFees;
              return (
                <tr key={r.courseId} className={`border-b border-black/[0.04] ${idx % 2 === 0 ? 'bg-black/[0.02]' : ''}`}>
                  <td className="px-4 py-3 font-medium">{r.courseName}</td>
                  <td className="px-4 py-3 text-right">{r.onlineBookings}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCentsCompact(r.onlineBookingFees)}</td>
                  <td className="px-4 py-3 text-right">{r.inPersonBookings}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatCentsCompact(r.inPersonBookingFees)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCentsCompact(r.onlineCancelledFees)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">{formatCentsCompact(r.inPersonCancelledFees)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCentsCompact(rowTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, bg, accent }: { label: string; value: string; bg: string; accent: string }) {
  return (
    <div className={`${bg} rounded-xl p-5 border border-black/5`}>
      <div className="text-xs font-medium text-foreground/60 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
      <div className="text-xs font-medium text-foreground/60 mb-2">{label}</div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}
