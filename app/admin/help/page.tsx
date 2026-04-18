export default function HelpPage() {
  const faqs = [
    {
      question: "How do I issue a new certificate?",
      answer: "Go to the Dashboard and click the 'Issue Certificate' button in the sidebar, or navigate to Certificates > New Entry. Fill in the recipient details and select the appropriate category."
    },
    {
      question: "How does certificate verification work?",
      answer: "Recipients receive a unique Certificate ID. Anyone can verify the certificate by entering this ID on the public verification portal."
    },
    {
      question: "Can I bulk send certificates?",
      answer: "Yes! Navigate to Bulk Email in the sidebar. Select the recipient category, choose a template, compose your message, and click 'Send Batch'."
    },
    {
      question: "How do I revoke a certificate?",
      answer: "Go to Certificates, find the certificate, click the delete icon, and confirm the action. The certificate status will be marked as revoked."
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Help Center
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Get answers to common questions and learn how to use the admin portal.
        </p>
      </header>

      {/* FAQ Section */}
      <div className="max-w-3xl space-y-4 mb-12">
        <h3 className="text-xl font-headline font-bold text-brand-dark-green">Frequently Asked Questions</h3>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white p-4 sm:p-6 rounded-xl border border-green-100 shadow-sm">
              <h4 className="font-medium text-brand-dark-green mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-vivid-green text-xl">help</span>
                {faq.question}
              </h4>
              <p className="text-sm text-on-surface-variant pl-7">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="max-w-3xl">
        <div className="bg-green-50 rounded-xl p-6 sm:p-8 border border-green-100">
          <h3 className="text-lg font-headline font-bold text-brand-dark-green mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-vivid-green">support_agent</span>
            Need More Help?
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            If you can't find the answer you're looking for, contact our support team.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="mailto:support@pharmacozyme.com" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white rounded-xl text-brand-green font-medium hover:bg-green-100 transition-colors">
              <span className="material-symbols-outlined">email</span>
              Email Support
            </a>
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 vivid-gradient-cta text-white rounded-xl font-medium">
              <span className="material-symbols-outlined">chat</span>
              Live Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
