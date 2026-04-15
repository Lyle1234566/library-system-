'use client';

import { useEffect, useMemo, useState } from 'react';
import { booksApi } from '@/lib/api';

type StatItem = {
  label: string;
  value: string;
};

type StatsSnapshot = {
  booksCataloged: number;
  activeStudents: number;
  averagePickupMinutes: number;
  borrowSuccessRate: number;
};

const fallbackStats: StatsSnapshot = {
  booksCataloged: 12000,
  activeStudents: 3500,
  averagePickupMinutes: 4,
  borrowSuccessRate: 98,
};

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M+`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${Math.round(value)}`;
}

export default function AboutStatsGrid() {
  const [stats, setStats] = useState<StatsSnapshot>(fallbackStats);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      const result = await booksApi.getPublicStats();
      if (!mounted || result.error || !result.data) {
        return;
      }

      setStats({
        booksCataloged: result.data.books_cataloged,
        activeStudents: result.data.active_students,
        averagePickupMinutes: result.data.average_pickup_minutes,
        borrowSuccessRate: result.data.borrow_success_rate,
      });
    };

    void loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  const statItems = useMemo<StatItem[]>(
    () => [
      { label: 'Books cataloged', value: `${formatCompact(stats.booksCataloged)}+` },
      { label: 'Active students', value: formatCompact(stats.activeStudents) },
      { label: 'Average pickup time', value: `${Math.max(0, Math.round(stats.averagePickupMinutes))} mins` },
      {
        label: 'Borrow success rate',
        value: `${Math.max(0, Math.min(100, Math.round(stats.borrowSuccessRate)))}%`,
      },
    ],
    [stats]
  );

  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-4">
      {statItems.map((stat, index) => (
        <div
          key={stat.label}
          style={{ animationDelay: `${index * 90 + 120}ms` }}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl animate-fade-up transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
        >
          <p className="text-lg font-semibold text-white">{stat.value}</p>
          <p className="text-xs text-white/65">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
