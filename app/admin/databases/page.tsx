"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import DatabaseManager from "@/components/admin/databases/DatabaseManager";
import CategoryTabs from "@/components/admin/databases/CategoryTabs";
import { parseCategoryParam } from "@/lib/category";

function Page() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = parseCategoryParam(params.get("cat")) ?? "General";
  const [counts, setCounts] = useState({ General: 0, Official: 0 });

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((d) => {
        const list = d.databases || [];
        setCounts({
          General: list.filter((x: { category?: string }) => x.category === "General").length,
          Official: list.filter((x: { category?: string }) => x.category === "Official").length,
        });
      })
      .catch(() => {});
  }, []);

  const setCat = (c: "General" | "Official") =>
    router.replace(`${pathname}?cat=${c.toLowerCase()}`);

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <CategoryTabs active={active} counts={counts} onChange={setCat} />
      <DatabaseManager key={active} category={active} />
    </div>
  );
}

export default function DatabaseManagementPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
