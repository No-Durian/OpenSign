import { useState, useEffect } from "react";
import { lazyWithRetry, hideUpgradeProgress } from "./utils";
import { Routes, Route, BrowserRouter, Navigate } from "react-router";
import { pdfjs } from "react-pdf";
import PageNotFound from "./pages/PageNotFound";
import Lazy from "./primitives/LazyPage";
import Loader from "./primitives/Loader";
import { serverUrl_fn } from "./constant/appinfo";
import Title from "./components/Title";
import HomeLayout from "./layout/HomeLayout";

const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const PolicySearch = lazyWithRetry(
  () => import("./pages/enterprise/PolicySearch")
);
const PolicyManagement = lazyWithRetry(
  () => import("./pages/enterprise/PolicyManagement")
);
const ComplianceAssistant = lazyWithRetry(
  () => import("./pages/enterprise/ComplianceAssistant")
);

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
              <Route
                path="/dashboard/:id"
                element={<Lazy Page={Dashboard} />}
              />
              <Route
                path="/policy-search"
                element={<Lazy Page={PolicySearch} />}
              />
              <Route
                path="/policy-management"
                element={<Lazy Page={PolicyManagement} />}
              />
              <Route
                path="/compliance-ai"
                element={<Lazy Page={ComplianceAssistant} />}
              />
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
