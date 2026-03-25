import { useState, useEffect } from "react";
import { lazyWithRetry, hideUpgradeProgress } from "./utils";
import { Routes, Route, BrowserRouter, Navigate } from "react-router";
import { pdfjs } from "react-pdf";
import HomeLayout from "./layout/HomeLayout";
import PageNotFound from "./pages/PageNotFound";
import Lazy from "./primitives/LazyPage";
import Loader from "./primitives/Loader";
import { serverUrl_fn } from "./constant/appinfo";
import Title from "./components/Title";

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
    <div className="bg-base-200">
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
                path="/policy-search"
                element={<Lazy Page={PolicySearch} />}
              />
              <Route
                path="/policy-management"
                element={<Lazy Page={PolicyManagement} />}
              />
              <Route
                path="/policy-message-board"
                element={<Lazy Page={PolicyMessageBoard} />}
              />
              <Route
                path="/compliance-ai"
                element={<Lazy Page={ComplianceAssistant} />}
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
