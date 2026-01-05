import { NavLink } from "react-router-dom";
import { GearSix, House, LockSimple, PaperPlaneTilt } from "phosphor-react";

import { useWallet } from "../state/wallet";

export function Shell({ children }: { children: React.ReactNode }) {
  const { lock, keys } = useWallet();
  const primary = keys[0];

  return (
    <div className="shell">
      <aside className="nav-panel">
        <div className="brand">
          <img src="/logo.png" alt="Baseline" className="brand-mark" />
          <div>
            <div className="brand-title">Baseline</div>
            <div className="brand-subtitle">Light Wallet</div>
          </div>
        </div>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            <House size={18} weight="duotone" />
            Home
          </NavLink>
          <NavLink to="/send" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            <PaperPlaneTilt size={18} weight="duotone" />
            Send
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            <GearSix size={18} weight="duotone" />
            Settings
          </NavLink>
        </div>
        <div className="nav-footer">
          {primary && (
            <div className="address-chip">
              <div className="label">Primary</div>
              <code>{primary.address}</code>
            </div>
          )}
          <button className="btn btn-ghost" onClick={lock}>
            Lock
          </button>
        </div>
      </aside>
      <main className="shell-main">{children}</main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          <House size={20} weight="duotone" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/send" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          <PaperPlaneTilt size={20} weight="duotone" />
          <span>Send</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          <GearSix size={20} weight="duotone" />
          <span>Settings</span>
        </NavLink>
        <button type="button" className="bottom-nav-action" onClick={lock}>
          <LockSimple size={20} weight="duotone" />
          <span>Lock</span>
        </button>
      </nav>
    </div>
  );
}
