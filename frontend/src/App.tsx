import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.js";
import DownloadPage from "./pages/DownloadPage.js";
import HomePage from "./pages/HomePage.js";
import LegacyDownloadRedirect from "./pages/LegacyDownloadRedirect.js";
import SpedHomePage from "./pages/SpedHomePage.js";
import SpedMergeHomePage from "./pages/SpedMergeHomePage.js";
import ToolsHubPage from "./pages/ToolsHubPage.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/download/:jobId" element={<LegacyDownloadRedirect />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<ToolsHubPage />} />
          <Route path="/tools/nfe" element={<HomePage />} />
          <Route path="/tools/nfe/download/:jobId" element={<DownloadPage />} />
          <Route path="/tools/sped" element={<SpedHomePage />} />
          <Route path="/tools/sped/download/:jobId" element={<DownloadPage />} />
          <Route path="/tools/sped-merge" element={<SpedMergeHomePage />} />
          <Route path="/tools/sped-merge/download/:jobId" element={<DownloadPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
