import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import EnterpriseShell, {
  EnterpriseCard
} from "../../components/enterprise/EnterpriseShell";
import {
  buildPolicyFileUrl,
  fetchEnterpriseOverview
} from "../../constant/enterpriseApi";
import Loader from "../../primitives/Loader";

const formatDate = (value) => {
  if (!value) return "未获取";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未获取";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const EnterprisePortal = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchEnterpriseOverview()
      .then((response) => {
        if (!active) return;
        setData(response);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.response?.data?.message || err.message || "读取制度门户失败"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "制度库数量", value: `${data.libraryCount || 0}` },
      { label: "已过期文件", value: `${data.expired?.length || 0}` },
      { label: "即将过期文件", value: `${data.upcoming?.length || 0}` },
      { label: "最近更新", value: data.latestLibraryUpdateLabel || "未获取" },
      { label: "台账记录数", value: `${data.workbookRecordCount || 0}` }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="op-card bg-base-100 h-[320px] flex justify-center items-center shadow-md">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <EnterpriseShell
        title="制度门户"
        description="自动读取本地制度目录、台账与到期信息。"
      >
        <EnterpriseCard title="读取失败">
          <p className="text-sm text-error">{error}</p>
        </EnterpriseCard>
      </EnterpriseShell>
    );
  }

  return (
    <EnterpriseShell
      title="制度门户"
      description={`制度库路径：${data?.config?.libraryRoot || "未配置"}\n台账路径：${data?.config?.expiryRoot || "未配置"}`}
      actions={
        <button
          className="op-btn op-btn-primary"
          onClick={() => navigate("/policy-search")}
        >
          打开制度查询模块
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <EnterpriseCard
            key={card.label}
            title={card.label}
            className="min-h-[140px]"
          >
            <p className="text-3xl font-semibold text-base-content">
              {card.value}
            </p>
          </EnterpriseCard>
        ))}
      </div>

      <EnterpriseCard
        title="系统配置"
        subtitle="制度查询会先读取检查过期文件目录中的 Excel 台账，再去制度内容目录匹配原文。"
      >
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">制度内容目录</p>
            <p className="break-all text-base-content/70">
              {data?.config?.libraryRoot || "未配置"}
            </p>
          </div>
          <div>
            <p className="font-semibold">检查过期文件目录</p>
            <p className="break-all text-base-content/70">
              {data?.config?.expiryRoot || "未配置"}
            </p>
          </div>
          <div>
            <p className="font-semibold">制度管理目录</p>
            <p className="break-all text-base-content/70">
              {data?.config?.managementRoot || "未配置"}
            </p>
          </div>
        </div>
      </EnterpriseCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <EnterpriseCard
          title={`制度库：${data?.libraryCount || 0}`}
          subtitle="展示第一层制度库目录名称和其中包含的文件数量，可点击进入查询模块。"
        >
          <div className="space-y-3">
            {data?.libraries?.length ? (
              data.libraries.map((library) => (
                <button
                  key={library.name}
                  className="w-full text-left rounded-xl border border-base-300 p-4 hover:bg-base-200 transition"
                  onClick={() =>
                    navigate(
                      `/policy-search?library=${encodeURIComponent(library.name)}`
                    )
                  }
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <p className="font-semibold text-base-content">
                      {library.name}：{library.fileCount} 个文件
                    </p>
                    <span className="text-xs text-base-content/60">
                      最后修改：
                      {library.latestModifiedAtLabel ||
                        formatDate(library.latestModifiedAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-base-content/70">
                    {library.sampleFiles?.slice(0, 5).map((file) => (
                      <span
                        key={`${library.name}-${file.relativePath}`}
                        className="rounded-full bg-base-200 px-2 py-1"
                      >
                        {file.title}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-base-content/70">
                当前制度目录中尚未检测到知识库文件夹。
              </p>
            )}
          </div>
        </EnterpriseCard>

        <EnterpriseCard
          title="制度库最后修改日期"
          subtitle={`最新更新时间：${data?.latestLibraryUpdateLabel || "未获取"}`}
        >
          <div className="space-y-3 text-sm text-base-content/80">
            {(data?.libraries || []).slice(0, 6).map((library) => (
              <div
                key={library.name}
                className="flex justify-between gap-3 border-b border-base-300 pb-2"
              >
                <span>{library.name}</span>
                <span>
                  {library.latestModifiedAtLabel ||
                    formatDate(library.latestModifiedAt)}
                </span>
              </div>
            ))}
          </div>
        </EnterpriseCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <EnterpriseCard
          title="已过期文件"
          subtitle="根据台账中 G 列“有效期”自动识别。"
        >
          <div className="space-y-3">
            {data?.expired?.length ? (
              data.expired.map((item) => (
                <div
                  key={`${item.title}-${item.expiryDate}`}
                  className="rounded-xl border border-error/20 bg-error/5 p-4"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-base-content">
                      {item.title || "未命名制度"}
                    </p>
                    <p className="text-sm text-base-content/70">
                      过期时间：{formatDate(item.expiryDate)}
                    </p>
                    {item.file?.relativePath ? (
                      <a
                        className="text-sm text-primary underline-offset-2 hover:underline"
                        href={buildPolicyFileUrl(item.file.relativePath)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        阅读原文
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-base-content/70">
                当前未识别到已过期文件。
              </p>
            )}
          </div>
        </EnterpriseCard>

        <EnterpriseCard
          title="即将过期文件"
          subtitle="展示 1 年内即将过期的制度文件。"
        >
          <div className="space-y-3">
            {data?.upcoming?.length ? (
              data.upcoming.map((item) => (
                <div
                  key={`${item.title}-${item.expiryDate}`}
                  className="rounded-xl border border-warning/20 bg-warning/5 p-4"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-base-content">
                      {item.title || "未命名制度"}
                    </p>
                    <p className="text-sm text-base-content/70">
                      还剩 {item.daysLeft} 天过期（到期日：
                      {formatDate(item.expiryDate)}）
                    </p>
                    {item.file?.relativePath ? (
                      <a
                        className="text-sm text-primary underline-offset-2 hover:underline"
                        href={buildPolicyFileUrl(item.file.relativePath)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        阅读原文
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-base-content/70">
                当前未识别到 1 年内即将过期文件。
              </p>
            )}
          </div>
        </EnterpriseCard>
      </div>
    </EnterpriseShell>
  );
};

export default EnterprisePortal;
