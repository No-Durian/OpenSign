import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Sidebar from "../components/sidebar/Sidebar";
import Loader from "../primitives/Loader";

const HomeLayout = () => {
  const [isLoader, setIsLoader] = useState(true);

  useEffect(() => {
    localStorage.setItem("isGuestSigner", "");
    setIsLoader(false);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="z-[501]">
        {!isLoader && <Header setIsLoggingOut={() => {}} />}
      </header>
      {isLoader ? (
        <div className="flex h-[100vh] justify-center items-center">
          <Loader />
        </div>
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main
              id="renderList"
              className="flex-1 overflow-auto transition-all duration-300 ease-in-out"
            >
              <Outlet />
              <Footer />
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default HomeLayout;
