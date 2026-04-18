export default function ReportsPage() {
  const stats = [
    { label: "Total Issued", value: "12,842", change: "+12%", trend: "up" },
    { label: "Verified", value: "11,245", change: "+8%", trend: "up" },
    { label: "Pending", value: "892", change: "-3%", trend: "down" },
    { label: "Revoked", value: "705", change: "+2%", trend: "up" },
  ];

  const recentActivity = [
    { action: "Certificate issued to Johnathan Doe", time: "2 minutes ago", type: "issued" },
    { action: "Certificate verified by Dr. Sarah", time: "15 minutes ago", type: "verified" },
    { action: "Batch email sent to 142 recipients", time: "1 hour ago", type: "email" },
    { action: "Category MED-Q updated", time: "3 hours ago", type: "updated" },
    { action: "Certificate revoked for James Wilson", time: "5 hours ago", type: "revoked" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Reports & Analytics
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Monitor certificate issuance and verification metrics.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-4 sm:p-6 rounded-xl border border-green-100 shadow-sm">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">{stat.label}</p>
            <p className="text-2xl sm:text-3xl font-headline font-bold text-brand-dark-green">{stat.value}</p>
            <p className={`text-xs font-bold mt-2 ${stat.trend === "up" ? "text-brand-grass-green" : "text-error"}`}>
              {stat.change} from last month
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Recent Activity</h3>
          </div>
          <div className="divide-y divide-green-50">
            {recentActivity.map((item, index) => (
              <div key={index} className="p-4 flex items-start gap-4 hover:bg-green-50/30 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.type === "issued" ? "bg-green-100 text-brand-green" :
                  item.type === "verified" ? "bg-blue-100 text-blue-500" :
                  item.type === "email" ? "bg-purple-100 text-purple-500" :
                  item.type === "updated" ? "bg-yellow-100 text-yellow-600" :
                  "bg-red-100 text-error"
                }`}>
                  <span className="material-symbols-outlined text-lg">
                    {item.type === "issued" ? "verified" :
                     item.type === "verified" ? "check_circle" :
                     item.type === "email" ? "mail" :
                     item.type === "updated" ? "edit" :
                     "cancel"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-dark-green truncate">{item.action}</p>
                  <p className="text-xs text-on-surface-variant">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Options */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Export Data</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-on-surface-variant">Download certificate data in various formats for backup or analysis.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors">
                <span className="material-symbols-outlined">table_chart</span>
                <span className="font-medium">Export CSV</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors">
                <span className="material-symbols-outlined">picture_as_pdf</span>
                <span className="font-medium">Export PDF</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors">
                <span className="material-symbols-outlined">description</span>
                <span className="font-medium">Export JSON</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors">
                <span className="material-symbols-outlined">download</span>
                <span className="font-medium">Full Backup</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
