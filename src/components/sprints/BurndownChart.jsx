/**
 * BurndownChart.jsx
 * Sprint burndown — ideal line vs actual completion line.
 * Drop into src/components/sprints/BurndownChart.jsx
 *
 * Props:
 *   sprint  — Sprint object { start_date, end_date }
 *   issues  — Issue[] filtered to this sprint
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { eachDayOfInterval, format, parseISO, isAfter, startOfDay } from 'date-fns';

function buildChartData(sprint, issues) {
  if (!sprint?.start_date || !sprint?.end_date) return [];

  const start = startOfDay(parseISO(sprint.start_date));
  const end   = startOfDay(parseISO(sprint.end_date));
  const today = startOfDay(new Date());
  const total = issues.length;

  if (total === 0) return [];

  const days = eachDayOfInterval({ start, end });
  const totalDays = days.length - 1;

  return days.map((day, i) => {
    const label = format(day, 'MMM d');

    // Ideal: linear burndown from total → 0
    const ideal = Math.round(total - (total / totalDays) * i);

    // Actual: count issues NOT yet done as of this day
    // Only plot actual up to today
    let actual = null;
    if (!isAfter(day, today)) {
      const completedByDay = issues.filter((issue) => {
        if (!issue.completed_at) return false;
        const completedOn = startOfDay(parseISO(issue.completed_at));
        return !isAfter(completedOn, day);
      }).length;
      actual = total - completedByDay;
    }

    return { day: label, ideal, actual };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="capitalize">
          {p.name}: <span className="font-semibold text-white">{p.value ?? '—'}</span>
        </p>
      ))}
    </div>
  );
};

export default function BurndownChart({ sprint, issues = [] }) {
  const data = buildChartData(sprint, issues);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/20 text-sm">
        No data — add issues to this sprint with a start and end date.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
          Burndown
        </h3>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-px bg-white/20 inline-block border-dashed border-t border-white/20" />
            Ideal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-px bg-blue-500 inline-block" />
            Actual
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="day"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="linear"
            dataKey="ideal"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="ideal"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#60a5fa' }}
            connectNulls={false}
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
