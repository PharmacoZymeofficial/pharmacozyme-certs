export default function TrustBadges() {
  const badges = [
    {
      icon: "lock",
      label: "Tamper-Proof Records",
    },
    {
      icon: "bolt",
      label: "Instant Verification",
    },
    {
      icon: "shield",
      label: "Secure & Private",
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row flex-wrap justify-between gap-4 sm:gap-6 pt-2 sm:pt-4">
      {badges.map((badge, index) => (
        <div key={index} className="flex items-center gap-2 sm:gap-3">
          <span className="material-symbols-outlined text-vivid-green text-lg sm:text-xl">
            {badge.icon}
          </span>
          <span className="text-[10px] sm:text-[10px] font-bold uppercase tracking-widest text-outline">
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}
