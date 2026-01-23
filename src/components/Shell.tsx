import { NavLink, useLocation } from "react-router-dom";
import { GearSix, House, LockSimple, PaperPlaneTilt } from "phosphor-react";
import { useWallet } from "../state/wallet";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { motion } from "framer-motion";

export function Shell({ children }: { children: React.ReactNode }) {
  const { lock, keys } = useWallet();
  const primary = keys[0];
  const location = useLocation();

  const navItems = [
    { to: "/", icon: House, label: "Home" },
    { to: "/send", icon: PaperPlaneTilt, label: "Send" },
    { to: "/settings", icon: GearSix, label: "Settings" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text selection:bg-accent/20">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r border-white/5 bg-panel/30 backdrop-blur-xl p-6">
        <div className="flex items-center gap-4 mb-10">
          <div className="relative h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-panel-strong to-black border border-white/10 shadow-lg shadow-accent/10">
            <img src="/icon.png" alt="Logo" className="h-8 w-8 object-contain" />
            <div className="absolute inset-0 rounded-xl bg-accent/5" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide">Baseline Cash</h1>
            <p className="text-xs text-muted uppercase tracking-wider font-medium">Light Wallet</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                {({ isActive }) => (
                  <div className="relative px-4 py-3 rounded-xl transition-all duration-200 group hover:bg-white/5">
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-accent/10 border border-accent/20 rounded-xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className={cn(
                      "relative flex items-center gap-3 font-medium z-10",
                      isActive ? "text-accent-strong" : "text-muted group-hover:text-text"
                    )}>
                      <item.icon size={20} weight={isActive ? "duotone" : "regular"} />
                      {item.label}
                    </span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          {primary && (
            <div className="p-4 rounded-xl border border-dashed border-white/10 bg-black/20 shadow-inner">
              <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Primary Address</div>
              <code className="text-xs text-white/70 break-all font-mono leading-relaxed">{primary.address}</code>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={lock} className="w-full justify-start border-white/10 hover:border-danger/30 hover:bg-danger/5 hover:text-danger text-muted transition-colors">
            <LockSimple size={18} className="mr-2" />
            Lock Wallet
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col safe-area-top">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-bg to-bg pointer-events-none" />
        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative z-10">
          <div className="max-w-5xl mx-auto flex flex-col">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden border-t border-white/5 bg-panel/80 backdrop-blur-xl p-2 grid grid-cols-4 gap-1 safe-area-bottom">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center p-2 rounded-xl text-xs gap-1 transition-colors",
                isActive ? "text-accent bg-accent/10" : "text-muted active:bg-white/5"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={24} weight={isActive ? "duotone" : "regular"} />
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button onClick={lock} className="flex flex-col items-center justify-center p-2 rounded-xl text-xs gap-1 text-muted active:bg-danger/10 active:text-danger transition-colors">
            <LockSimple size={24} />
            <span className="font-medium">Lock</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
