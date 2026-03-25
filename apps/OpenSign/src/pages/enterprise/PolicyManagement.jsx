import { useEffect, useState } from "react";
import EnterpriseShell, {
  EnterpriseCard
} from "../../components/enterprise/EnterpriseShell";
import {
  buildPolicyFileUrl,
  fetchPolicyManagement
} from "../../constant/enterpriseApi";
import Loader from "../../primitives/Loader";

const sections = [
  { key: "newItems", title: "今年新增" },
  { key: "modifiedItems", title: "有修改" },
  { key: "abolishedItems", title: "废止" }
];

const PolicyManagement = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchPolicyManagement()
      .then((response) => {
        if (!active) return;
        setData(response);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.response?.data?.message || err.message || "读取制度管理数据失败"
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
      title="制度管理"
      description={`管理目录路径：${data?.rootPath || "未配置"}\n请在该目录下放置“新增 / 有修改 / 废止”子文件夹，系统会自动统计文件。`}
    >
      {loading ? (
        <div className="op-card bg-base-100 h-[320px] flex justify-center items-center shadow-md">
          <Loader />
        </div>
      ) : error ? (
        <EnterpriseCard title="读取失败">
          <p className="text-error text-sm">{error}</p>
        </EnterpriseCard>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {sections.map((section) => (
            <EnterpriseCard
              key={section.key}
              title={`${section.title}（${data?.summary?.[section.key] || 0}）`}
            >
              <div className="space-y-3">
                {data?.[section.key]?.length ? (
                  data[section.key].map((item) => (
                    <div
                      key={item.relativePath}
                      className="rounded-xl border border-base-300 p-4"
                    >
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-base-content/60 mt-1">
                        更新日期：
                        {item.modifiedAt
                          ? item.modifiedAt.slice(0, 10)
                          : "未获取"}
                      </p>
                      <a
                        className="text-sm text-primary underline-offset-2 hover:underline mt-2 inline-block"
                        href={buildPolicyFileUrl(
                          item.relativePath,
                          "management"
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        阅读原文
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-base-content/70">
                    当前未读取到对应目录中的文件。
                  </p>
                )}
              </div>
            </EnterpriseCard>
          ))}
        </div>
      )}
    </EnterpriseShell>
  );
};

export default PolicyManagement;
