"use client";

import { useState, useEffect } from "react";
import { Category, SubCategory } from "@/lib/types";

const defaultCategories: Category[] = [
  {
    id: "general",
    name: "General",
    subCategories: ["Courses", "Workshops", "Webinars", "MED-Q"],
    isActive: true,
    order: 1,
  },
  {
    id: "official",
    name: "Official",
    subCategories: ["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"],
    isActive: true,
    order: 2,
  },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingSub, setIsAddingSub] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleCategory = async (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cat, isActive: !cat.isActive }),
      });
    } catch (err) {
      console.error("Failed to toggle category");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    setIsSaving(true);
    const newCat: Category = {
      id: newCategoryName.toLowerCase().replace(/\s+/g, "-"),
      name: newCategoryName,
      subCategories: [],
      isActive: true,
      order: categories.length + 1,
    };

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCat),
      });

      if (response.ok) {
        setCategories([...categories, newCat]);
        setNewCategoryName("");
        setIsAddingCategory(false);
      }
    } catch (err) {
      console.error("Failed to add category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSubCategory = async (categoryId: string) => {
    if (!newSubName.trim()) return;
    
    setCategories(categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          subCategories: [...cat.subCategories, newSubName] as (string | SubCategory)[],
        };
      }
      return cat;
    }));

    setNewSubName("");
    setIsAddingSub(null);
  };

  const handleDeleteSubCategory = (categoryId: string, subIndex: number) => {
    if (!confirm("Delete this subcategory?")) return;
    
    setCategories(categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          subCategories: cat.subCategories.filter((_, i) => i !== subIndex),
        };
      }
      return cat;
    }));
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!confirm("Delete this category and all its subcategories?")) return;
    setCategories(categories.filter(cat => cat.id !== categoryId));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
            Categories
          </h2>
          <p className="text-on-surface-variant font-body text-sm sm:text-base">
            Manage certificate categories and subcategories.
          </p>
        </div>

        <button
          onClick={() => setIsAddingCategory(true)}
          className="px-4 py-2 vivid-gradient-cta text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Category
        </button>
      </header>

      {/* Add Category Modal */}
      {isAddingCategory && (
        <div className="mb-6 bg-white rounded-xl border border-green-100 shadow-sm p-6">
          <h3 className="text-lg font-headline font-bold text-brand-dark-green mb-4">Add New Category</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name (e.g., Training)"
              className="flex-1 bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingCategory(false)}
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim() || isSaving}
                className="px-6 py-2 vivid-gradient-cta text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-transform active:scale-95"
              >
                {isSaving ? "Adding..." : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
              category.isActive ? "border-green-100" : "border-gray-200 opacity-60"
            }`}
          >
            {/* Category Header */}
            <div 
              className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-green-50/30 transition-colors"
              onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
            >
              <div className="flex items-center gap-4">
                {/* Expand/Collapse Icon */}
                <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${expandedCategory === category.id ? "rotate-90" : ""}`}>
                  chevron_right
                </span>

                {/* Category Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  category.isActive ? "bg-green-100 text-brand-green" : "bg-gray-100 text-gray-400"
                }`}>
                  <span className="material-symbols-outlined">
                    {category.name === "General" ? "school" : "verified"}
                  </span>
                </div>

                {/* Category Info */}
                <div>
                  <h3 className="text-lg font-headline font-bold text-brand-dark-green">{category.name}</h3>
                  <p className="text-sm text-on-surface-variant">
                    {category.subCategories.length} subcategories
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(category.id);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    category.isActive ? "bg-brand-vivid-green" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      category.isActive ? "left-7" : "left-1"
                    }`}
                  />
                </button>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(category.id);
                  }}
                  className="p-2 hover:bg-red-50 rounded-xl text-on-surface-variant hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>

            {/* Subcategories */}
            {expandedCategory === category.id && (
              <div className="border-t border-green-50 bg-green-50/20 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {category.subCategories.map((sub, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded-xl border border-green-100"
                    >
                      <span className="text-sm font-medium text-brand-dark-green">{typeof sub === 'string' ? sub : sub.name}</span>
                      <button
                        onClick={() => handleDeleteSubCategory(category.id, index)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))}

                  {/* Add Subcategory */}
                  {isAddingSub === category.id ? (
                    <div className="flex gap-2 p-2 bg-white rounded-xl border-2 border-dashed border-green-200">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="Subcategory name"
                        className="flex-1 bg-transparent text-sm outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddSubCategory(category.id)}
                        className="p-1 text-brand-vivid-green hover:bg-green-50 rounded"
                      >
                        <span className="material-symbols-outlined">check</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingSub(null);
                          setNewSubName("");
                        }}
                        className="p-1 text-error hover:bg-red-50 rounded"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingSub(category.id)}
                      className="flex items-center justify-center gap-2 p-3 bg-white rounded-xl border-2 border-dashed border-green-200 hover:border-brand-vivid-green hover:bg-green-50/30 transition-all text-brand-grass-green"
                    >
                      <span className="material-symbols-outlined">add</span>
                      <span className="text-sm font-medium">Add Subcategory</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-4 block">category</span>
          <h3 className="text-lg font-bold text-brand-dark-green mb-2">No Categories Yet</h3>
          <p className="text-sm text-on-surface-variant mb-4">Create your first category to organize certificates.</p>
          <button
            onClick={() => setIsAddingCategory(true)}
            className="px-6 py-2 vivid-gradient-cta text-white rounded-xl text-sm font-bold"
          >
            Add First Category
          </button>
        </div>
      )}
    </div>
  );
}
