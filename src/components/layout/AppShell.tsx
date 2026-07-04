import { NavLink, Outlet } from "react-router-dom";
import { ATTRIBUTION } from "../../types/data";

const TABS: { to: string; label: string; icon: string }[] = [
  { to: "/", label: "ホーム", icon: "🏠" },
  { to: "/practice", label: "演習", icon: "✏️" },
  { to: "/exam", label: "模試", icon: "⏱" },
  { to: "/stats", label: "統計", icon: "📊" },
  { to: "/niji", label: "2次", icon: "📝" },
];

/** モバイル最適化シェル: 下タブナビ + safe-area 対応 */
export function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 pb-24 pt-safe-top">
        <Outlet />
        <p className="mt-8 px-4 pb-2 text-center text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          {ATTRIBUTION}
        </p>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-lg justify-around pb-safe-bottom">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                  isActive
                    ? "font-bold text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400"
                }`
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
