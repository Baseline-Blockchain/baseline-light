import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { Shell } from "./components/Shell";
import { SettingsProvider } from "./state/settings";
import { WalletProvider, useWallet } from "./state/wallet";
import { CreateWalletScreen } from "./screens/CreateWallet";
import { ImportWalletScreen } from "./screens/ImportWallet";
import { LockScreen } from "./screens/LockScreen";
import { HomeScreen } from "./screens/Home";
import { SendScreen } from "./screens/Send";
import { SettingsScreen } from "./screens/Settings";

function Protected() {
  const { status, hasWallet } = useWallet();
  if (status === "empty" && !hasWallet) {
    return <Navigate to="/create" replace />;
  }
  if (status === "locked") {
    return <Navigate to="/lock" replace />;
  }
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/lock" element={<LockScreen />} />
            <Route path="/create" element={<CreateWalletScreen />} />
            <Route path="/import" element={<ImportWalletScreen />} />
            <Route element={<Protected />}>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/send" element={<SendScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </SettingsProvider>
  );
}
