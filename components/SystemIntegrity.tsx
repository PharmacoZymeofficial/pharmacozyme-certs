export default function SystemIntegrity() {
  const integrityItems = [
    {
      title: "API Security Audit",
      description: "Passed - 100% compliance",
      status: "active"
    },
    {
      title: "Blockchain Sync",
      description: "Block #8812-B verified",
      status: "active"
    },
    {
      title: "Data Redundancy",
      description: "Cloud-Mirror Active",
      status: "active"
    },
  ];

  return (
    <div className="bg-brand-dark-green text-white rounded-xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden relative shadow-lg h-full">
      {/* Background Watermark */}
      <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
        <span className="material-symbols-outlined !text-[180px] sm:!text-[240px]">verified_user</span>
      </div>

      {/* Content */}
      <div>
        <h4 className="text-lg sm:text-xl font-headline font-bold mb-2">System Integrity</h4>
        <p className="text-green-200/70 text-xs sm:text-sm mb-6 sm:mb-8">
          All verification nodes are operational. No critical vulnerabilities detected in the last 72 hours.
        </p>

        <div className="space-y-4 sm:space-y-6 relative z-10">
          {integrityItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3 sm:gap-4">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-brand-vivid-green shadow-[0_0_12px_rgba(34,197,94,0.6)] flex-shrink-0"></div>
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-xs text-green-300/60">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Button */}
      <button className="mt-6 sm:mt-8 py-3 bg-white/10 hover:bg-white/20 transition-all rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-brand-vivid-green border border-brand-vivid-green/30">
        Generate Full Audit Log
      </button>
    </div>
  );
}
