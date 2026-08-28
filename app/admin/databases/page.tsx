"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import DatabaseManager from "@/components/admin/databases/DatabaseManager";
import CategoryTabs from "@/components/admin/databases/CategoryTabs";
import { parseCategoryParam } from "@/lib/category";
import type { Database } from "@/lib/types";

function Page() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = parseCategoryParam(params.get("cat")) ?? "General";
  const [allDbs, setAllDbs] = useState<Database[]>([]);
  const counts = useMemo(() => ({
    General: allDbs.filter((d) => d.category === "General").length,
    Official: allDbs.filter((d) => d.category === "Official").length,
  }), [allDbs]);

  const setCat = (c: "General" | "Official") =>
    router.replace(`${pathname}?cat=${c.toLowerCase()}`);

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <CategoryTabs active={active} counts={counts} onChange={setCat} />
      <DatabaseManager key={active} category={active} onDatabasesLoaded={setAllDbs} />
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
