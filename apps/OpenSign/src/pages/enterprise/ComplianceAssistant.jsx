import { useEffect, useState } from "react";
import EnterpriseShell, {
  EnterpriseCard
} from "../../components/enterprise/EnterpriseShell";
import { fetchAiAssistantConfig } from "../../constant/enterpriseApi";
import Loader from "../../primitives/Loader";

const ComplianceAssistant = () => {
  const [loading, setLoading] = useState(true);
  const [assistantUrl, setAssistantUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchAiAssistantConfig()
      .then((data) => {
        if (!active) return;
        const targetUrl = data.url || "";
        setAssistantUrl(targetUrl);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.response?.data?.message || err.message || "读取 AI 助手配置失败"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <EnterpriseShell
      title="合规AI助手"
      description="点击侧边栏后会自动跳转到企业内网 AI 助手地址；如果跳转失败，可使用下方备用按钮。"
    >
      <EnterpriseCard
        title="助手入口"
        subtitle={`目标地址：${assistantUrl || "未配置"}`}
      >
        {loading ? (
          <div className="h-[520px] flex justify-center items-center">
            <Loader />
          </div>
        ) : error ? (
          <p className="text-sm text-error">{error}</p>
        ) : assistantUrl ? (
          <div className="space-y-3">
            <a
              className="op-btn op-btn-primary"
              href={assistantUrl}
              target="_self"
              rel="noreferrer"
            >
              重新跳转到合规 AI 助手
            </a>
            <iframe
              title="合规AI助手"
              src={assistantUrl}
              className="w-full min-h-[720px] rounded-xl border border-base-300 bg-white"
            />
          </div>
        ) : (
          <p className="text-sm text-base-content/70">尚未配置 AI 助手地址。</p>
        )}
      </EnterpriseCard>
    </EnterpriseShell>
  );
};

export default ComplianceAssistant;
