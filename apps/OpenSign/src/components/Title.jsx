import { useLocation, matchPath } from "react-router";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useManifestUrl } from "../hook/useManifestUrl";

const TITLE_MAP = {
  "/": "登录",
  "/dashboard/35KBoSgoAK": "制度门户",
  "/policy-search": "制度查询模块",
  "/policy-management": "制度管理",
  "/compliance-ai": "合规AI助手",
  "/profile": "个人信息",
  "/changepassword": "修改密码",
  "/forgetpassword": "忘记密码",
  "/addadmin": "初始化管理员",
  "/upgrade-2.1": "初始化管理员",
  "/success": "成功",
  "/verify-document": "制度验真",
  "/signaturePdf/:docId": "制度签署",
  "/placeHolderSign/:docId": "发起签署",
  "/login/:base64url": "签署入口"
};

function resolveTitle(pathname, override) {
  if (override) return override;
  for (let [pattern, label] of Object.entries(TITLE_MAP)) {
    if (matchPath({ path: pattern, end: true }, pathname)) {
      return label;
    }
  }
  return "制度系统";
}

export default function Title() {
  const { pathname, state } = useLocation();
  const { t } = useTranslation();
  const appName = "制度系统";
  const logo = useMemo(() => localStorage.getItem("favicon"), []);
  const prefix = useMemo(
    () => resolveTitle(pathname, state?.title),
    [pathname, state?.title]
  );
  const title = useMemo(
    () => (prefix ? `${t(prefix)} - ${appName}` : appName),
    [t, prefix, appName]
  );
  const manifestUrl = useManifestUrl(appName, logo);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={title} />
      {logo && <link rel="icon" type="image/png" href={logo} />}
      <link rel="manifest" href={manifestUrl} />
    </>
  );
}
