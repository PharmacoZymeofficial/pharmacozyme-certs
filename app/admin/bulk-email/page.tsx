import BulkEmailForm from "@/components/BulkEmailForm";

const categories = [
  "All Certificates",
  "General - Courses (PPC)",
  "General - Workshops",
  "General - Webinars",
  "General - MED-Q",
  "Official - Central Team",
  "Official - Sub Team",
  "Official - Ambassadors",
  "Official - Affiliates",
  "Official - Mentors",
];

const templates = [
  "Official Certification - Standard",
  "Official Certification - Premium",
  "Renewal Notification",
  "Credential Revoked",
  "Welcome Message",
  "Quarterly Report",
];

export default function BulkEmailPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Bulk Email Dispatch
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Send certificates and notifications to multiple recipients at once.
        </p>
      </header>

      {/* Email Form */}
      <div className="max-w-4xl">
        <BulkEmailForm categories={categories} templates={templates} />
      </div>

      {/* Recent Sent */}
      <div className="mt-8 bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-green-50">
          <h3 className="text-lg font-headline font-bold text-brand-dark-green">Recent Sent</h3>
        </div>
        <div className="divide-y divide-green-50">
          {[
            { date: "Oct 18, 2024", subject: "MED-Q Excellence Certificates", recipients: 142, status: "Sent" },
            { date: "Oct 15, 2024", subject: "Workshop Completion Certificates", recipients: 56, status: "Sent" },
            { date: "Oct 12, 2024", subject: "Quarterly Audit Notification", recipients: 234, status: "Sent" },
          ].map((item, index) => (
            <div key={index} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-green-50/30 transition-colors">
              <div>
                <p className="font-medium text-brand-dark-green">{item.subject}</p>
                <p className="text-sm text-on-surface-variant">{item.recipients} recipients • {item.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-green-50 text-brand-vivid-green rounded-full text-xs font-bold">
                  {item.status}
                </span>
                <button className="p-2 hover:bg-green-100 rounded-xl text-brand-grass-green transition-colors">
                  <span className="material-symbols-outlined">visibility</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
