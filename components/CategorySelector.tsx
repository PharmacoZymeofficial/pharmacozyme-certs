"use client";

import { useState } from "react";

interface CategorySelectorProps {
  selectedCategory: "General" | "Official";
  selectedSubCategory: string;
  onCategoryChange: (category: "General" | "Official") => void;
  onSubCategoryChange: (subCategory: string) => void;
}

const subCategories = {
  General: [
    { id: "courses", name: "Courses", icon: "school" },
    { id: "workshops", name: "Workshops", icon: "groups" },
    { id: "webinars", name: "Webinars", icon: "video_library" },
    { id: "medq", name: "MED-Q", icon: "verified", highlighted: true },
  ],
  Official: [
    { id: "central-team", name: "Central Team", icon: "apartment" },
    { id: "sub-team", name: "Sub Team", icon: "groups_2" },
    { id: "ambassadors", name: "Ambassadors", icon: "stars" },
    { id: "affiliates", name: "Affiliates", icon: "handshake" },
    { id: "mentors", name: "Mentors", icon: "school" },
  ],
};

export default function CategorySelector({
  selectedCategory,
  selectedSubCategory,
  onCategoryChange,
  onSubCategoryChange,
}: CategorySelectorProps) {
  const categories = subCategories[selectedCategory];

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Tabs - Horizontal scroll on mobile */}
      <div className="flex gap-4 sm:gap-8 border-b border-outline-variant/30 overflow-x-auto pb-1">
        <button
          onClick={() => {
            onCategoryChange("General");
            onSubCategoryChange("");
          }}
          className={`pb-3 sm:pb-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
            selectedCategory === "General"
              ? "text-vivid-green active-green-border"
              : "text-outline hover:text-dark-green"
          }`}
        >
          General
        </button>
        <button
          onClick={() => {
            onCategoryChange("Official");
            onSubCategoryChange("");
          }}
          className={`pb-3 sm:pb-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
            selectedCategory === "Official"
              ? "text-vivid-green active-green-border"
              : "text-outline hover:text-dark-green"
          }`}
        >
          Official
        </button>
      </div>

      {/* Subcategory Grid - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {categories.map((sub) => (
          <button
            key={sub.id}
            onClick={() => onSubCategoryChange(sub.id)}
            className={`
              group relative p-3 sm:p-5 rounded-xl transition-all cursor-pointer flex flex-col items-center text-center gap-2 sm:gap-3
              ${
                selectedSubCategory === sub.id
                  ? "bg-primary-container border-2 border-vivid-green"
                  : "bg-surface-container-low border-2 border-transparent hover:border-vivid-green/30"
              }
            `}
          >
            {/* Check indicator - shows for ALL selected items */}
            {selectedSubCategory === sub.id && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-vivid-green flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-white text-[10px] sm:text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check
                </span>
              </span>
            )}
            
            <span 
              className={`material-symbols-outlined text-vivid-green text-2xl sm:text-3xl group-hover:scale-110 transition-transform ${
                selectedSubCategory === sub.id ? '' : ''
              }`}
              style={selectedSubCategory === sub.id ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {sub.icon}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-dark-green leading-tight">
              {sub.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
