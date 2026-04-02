import { useState, useEffect } from "react";
import { hideUpgradeProgress } from "./utils";
import { Routes, Route, BrowserRouter, Navigate } from "react-router";
import { pdfjs } from "react-pdf";
import PageNotFound from "./pages/PageNotFound";
import Loader from "./primitives/Loader";
import { serverUrl_fn } from "./constant/appinfo";
import Title from "./components/Title";
import HomeLayout from "./layout/HomeLayout";
import Dashboard from "./pages/Dashboard";
import PolicySearch from "./pages/enterprise/PolicySearch";
import PolicyManagement from "./pages/enterprise/PolicyManagement";
import ComplianceAssistant from "./pages/enterprise/ComplianceAssistant";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
const AppLoader = () => {
  return (
    <div className="flex justify-center items-center h-[100vh]">
      <Loader />
    </div>
  );
};

function App() {
  const [isloading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = process.env.REACT_APP_APPID ?? "opensign";
    localStorage.setItem("parseAppId", id);
    localStorage.setItem("baseUrl", `${serverUrl_fn()}/`);
    if (!localStorage.getItem("i18nextLng")) {
      localStorage.setItem("i18nextLng", "zh");
    }
    hideUpgradeProgress();
    localStorage.removeItem("showUpgradeProgress");
    setIsLoading(false);
  }, []);

  return (
    <div className="bg-base-200 min-h-screen">
      {isloading ? (
        <AppLoader />
      ) : (
        <BrowserRouter>
          <Title />
          <Routes>
            <Route element={<HomeLayout />}>
              <Route
                path="/"
                element={<Navigate to="/dashboard/35KBoSgoAK" replace />}
              />
              <Route path="/dashboard/:id" element={<Dashboard />} />
              <Route path="/policy-search" element={<PolicySearch />} />
              <Route path="/policy-management" element={<PolicyManagement />} />
              <Route path="/compliance-ai" element={<ComplianceAssistant />} />
              <Route
                path="/profile"
                element={<Navigate to="/dashboard/35KBoSgoAK" replace />}
              />
              <Route
                path="/changepassword"
                element={<Navigate to="/dashboard/35KBoSgoAK" replace />}
              />
              <Route
                path="/verify-document"
                element={<Navigate to="/dashboard/35KBoSgoAK" replace />}
              />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </BrowserRouter>
      )}
    </div>
  );
}

export default App;
