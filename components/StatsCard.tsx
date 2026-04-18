interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendText?: string;
  trendColor?: "green" | "red" | "orange";
}

export default function StatCard({ title, value, subtitle, icon, trend = "neutral", trendText, trendColor = "green" }: StatCardProps) {
  const trendColors = {
    green: "text-brand-grass-green",
    red: "text-error",
    orange: "text-brand-vivid-green",
  };

  const iconBgColors = {
    green: "bg-green-100 text-brand-green",
    red: "bg-red-50 text-error",
    orange: "bg-green-50 text-brand-vivid-green",
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm relative overflow-hidden group">
      {/* Background Icon */}
      <div className="absolute -right-4 -top-4 text-green-50 opacity-40 group-hover:scale-110 transition-transform">
        <span className="material-symbols-outlined !text-7xl">{icon}</span>
      </div>

      <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-headline font-bold text-brand-dark-green">{value}</h3>

      <div className={`mt-4 flex items-center text-xs font-bold ${trendColors[trendColor]}`}>
        <span className="material-symbols-outlined text-sm">{trend === "up" ? "trending_up" : trend === "down" ? "priority_high" : "bolt"}</span>
        <span className="ml-1">{trendText || subtitle}</span>
      </div>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: StatCardProps[] }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </section>
  );
}
