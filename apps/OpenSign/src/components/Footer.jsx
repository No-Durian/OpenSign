import React, { useEffect, useState } from "react";
import Package from "../../package.json";
import axios from "axios";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  const [showButton, setShowButton] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    axios
      .get("/version.txt")
      .then((response) => setVersion(response.data))
      .catch(() => setVersion(Package.version));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowButton(window.pageYOffset >= 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo(0, 0);
    setShowButton(false);
  };

  return (
    <>
      <footer className="op-footer op-footer-center py-3 bg-base-300 text-base-content text-center text-[13px]">
        <aside>
          <p>
            {t("all-right")} &copy; {new Date().getFullYear()} 制度系统（
            {t("version")}：{version || Package.version}）
          </p>
        </aside>
      </footer>
      <button
        className={`${showButton ? "block" : "hidden"} fixed bottom-4 right-4 px-3 p-2 text-xl op-bg-secondary text-white rounded focus:outline-none`}
        onClick={scrollToTop}
      >
        <i className="fa-light fa-angle-up"></i>
      </button>
    </>
  );
};

export default Footer;
