/* The top ribbon shared with the homepage (website repo, src/components/Ribbon.js): signature logo on the
   left, a Home / Health switch in the middle, the theme picker on the right. Keep the two in step.
   Links are absolute so they work from chinh-recovery.vercel.app too. */
import React from "react";
import ThemeSwitch from "./ThemeSwitch.jsx";

const SITE = "https://www.duychinhdinh.com";
const APPS = [
  { id: "home", label: "Home", href: `${SITE}/` },
  { id: "health", label: "Health", href: `${SITE}/chinh-recovery` },
];

export default function Ribbon({ active = "health" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-page/85 backdrop-blur-md">
      <nav aria-label="Main" className="chinh-gutter relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
        <a href={`${SITE}/`} aria-label="Tony Dinh, home" className="-ml-1 flex min-h-11 items-center rounded-md px-1 text-slate-100 transition hover:text-cyan-400">
          <span aria-hidden="true" className="signature h-10 sm:h-12" />
        </a>
        <div className="chinh-tile flex items-center gap-1 p-1 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          {APPS.map((app) => {
            const on = app.id === active;
            return (
              <a key={app.id} href={app.href} aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm font-semibold transition sm:px-4 ${on ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"}`}>
                {app.label}
              </a>
            );
          })}
        </div>
        <ThemeSwitch />
      </nav>
    </header>
  );
}
