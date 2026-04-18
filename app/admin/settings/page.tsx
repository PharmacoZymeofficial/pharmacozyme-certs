"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoIssue, setAutoIssue] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Settings
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Configure your certificate verification system.
        </p>
      </header>

      <div className="max-w-3xl space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">General Settings</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-6">
            {/* Email Notifications */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="font-medium text-brand-dark-green">Email Notifications</p>
                <p className="text-sm text-on-surface-variant">Receive email alerts for new certificate requests</p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  emailNotifications ? "bg-brand-vivid-green" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    emailNotifications ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Auto Issue */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="font-medium text-brand-dark-green">Auto Issue Certificates</p>
                <p className="text-sm text-on-surface-variant">Automatically issue certificates upon course completion</p>
              </div>
              <button
                onClick={() => setAutoIssue(!autoIssue)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoIssue ? "bg-brand-vivid-green" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    autoIssue ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Require Approval */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="font-medium text-brand-dark-green">Require Approval</p>
                <p className="text-sm text-on-surface-variant">Certificates require admin approval before issuing</p>
              </div>
              <button
                onClick={() => setRequireApproval(!requireApproval)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  requireApproval ? "bg-brand-vivid-green" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    requireApproval ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Email Settings</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">Sender Name</label>
              <input
                type="text"
                defaultValue="PharmacoZyme Certificates"
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">Sender Email</label>
              <input
                type="email"
                defaultValue="certificates@pharmacozyme.com"
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button className="px-8 py-3 vivid-gradient-cta text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
