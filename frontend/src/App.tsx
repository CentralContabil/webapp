import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DownloadPage from "./pages/DownloadPage.js";
import HomePage from "./pages/HomePage.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/download/:jobId" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
