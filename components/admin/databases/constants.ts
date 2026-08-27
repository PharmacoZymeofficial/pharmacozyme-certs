export const SENDER_IDENTITIES = [
  { name: "PharmacoZyme Certificates", email: "" },
  { name: "PharmacoZyme Official", email: "info@pharmacozyme.com" },
  { name: "PZ Academy", email: "info@pzacademy.pharmacozyme.com" },
];

export const categoryStructure = {
  General: {
    Courses: ["Module 1", "Module 2", "Module 3", "Module 4", "Course Completion"],
    Workshops: ["Workshop"],
    Webinars: ["Webinar"],
    "MED-Q": ["MED-Q Assessment"],
  },
  Official: {
    "Central Team": ["Team Certificate"],
    "Sub Team": ["Team Certificate"],
    Ambassadors: ["Ambassador Certificate"],
    Affiliates: ["Affiliate Certificate"],
    Mentors: ["Mentor Certificate"],
  },
};

export const subCategoryShortMap: Record<string, string> = {
  "Courses": "CRS",
  "Workshops": "WKS",
  "Webinars": "WBN",
  "MED-Q": "MDQ",
  "Central Team": "CTM",
  "Sub Team": "STM",
  "Ambassadors": "AMB",
  "Affiliates": "AFF",
  "Mentors": "MTR",
};
