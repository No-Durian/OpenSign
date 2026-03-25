import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import EnterpriseShell, {
  EnterpriseCard
} from "../../components/enterprise/EnterpriseShell";
import {
  buildPolicyFileByNameUrl,
  buildPolicyFileUrl,
  fetchEnterpriseSearchOptions,
  searchPolicies
} from "../../constant/enterpriseApi";
import Loader from "../../primitives/Loader";

const emptyFilters = {
  library: "",
  keyword: "",
  department: "",
  year: "",
  category: ""
};

const PolicySearch = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [options, setOptions] = useState({
    libraries: [],
    departments: [],
    years: [],
    categories: []
  });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [xlsxAvailable, setXlsxAvailable] = useState(true);

  useEffect(() => {
    const initialLibrary = searchParams.get("library") || "";
    setFilters((prev) => ({ ...prev, library: initialLibrary }));
    let active = true;
    fetchEnterpriseSearchOptions()
      .then((data) => {
        if (!active) return;
        setOptions(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.response?.data?.message || err.message || "读取筛选条件失败"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    handleSearch(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSearch = async (currentFilters) => {
    setSearching(true);
    try {
      const response = await searchPolicies(currentFilters);
      setResults(response.results || []);
      setTotal(response.total || 0);
      setXlsxAvailable(response.xlsxAvailable !== false);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "查询制度失败");
    } finally {
      setSearching(false);
    }
  };

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const summary = useMemo(
    () =>
      `当前共检索到 ${total} 条制度记录，支持按制度库、关键词、部门、年份和制度分类进行筛选。`,
    [total]
  );

  return (
    <EnterpriseShell
      title="制度查询模块"
      description="先读取检查过期文件目录中的 Excel 台账字段（部门、年份、分类等），再到制度内容目录中匹配原文文件。"
      actions={
        <button
          className="op-btn op-btn-primary"
          onClick={() => handleSearch(filters)}
        >
          开始检索
        </button>
      }
    >
      <EnterpriseCard title="查询条件" subtitle={summary}>
        {loading ? (
          <div className="h-[120px] flex justify-center items-center">
            <Loader />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <label className="form-control gap-2">
              <span className="text-sm font-medium">制度库</span>
              <select
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={filters.library}
                onChange={handleChange("library")}
              >
                <option value="">全部制度库</option>
                {options.libraries.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">关键词</span>
              <input
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={filters.keyword}
                onChange={handleChange("keyword")}
                placeholder="输入制度简称、文号或文件名"
              />
            </label>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">发布部门</span>
              <select
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={filters.department}
                onChange={handleChange("department")}
              >
                <option value="">全部部门</option>
                {options.departments.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">发布年份</span>
              <select
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={filters.year}
                onChange={handleChange("year")}
              >
                <option value="">全部年份</option>
                {options.years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">制度分类</span>
              <select
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={filters.category}
                onChange={handleChange("category")}
              >
                <option value="">全部分类</option>
                {options.categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </EnterpriseCard>

      <EnterpriseCard
        title="检索结果"
        subtitle={error || "点击“阅读原文”即可打开制度文件。"}
      >
        {!xlsxAvailable ? (
          <div className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-content">
            当前服务端缺少 xlsx 解析依赖，暂时无法读取“检查过期文件”目录中的
            Excel。 请在 OpenSignServer 安装 xlsx 后重启服务。
          </div>
        ) : null}
        {searching ? (
          <div className="h-[200px] flex justify-center items-center">
            <Loader />
          </div>
        ) : results.length ? (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>制度简称</th>
                  <th>制度库</th>
                  <th>发布部门</th>
                  <th>发布年份</th>
                  <th>制度分类</th>
                  <th>有效期</th>
                  <th>原文</th>
                  <th>台账来源</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={`${item.title}-${item.docNo}-${item.relativePath}`}>
                    <td>
                      <div className="font-semibold">
                        {item.title || "未命名制度"}
                      </div>
                      <div className="text-xs text-base-content/60">
                        文号：{item.docNo || "未填写"}
                      </div>
                    </td>
                    <td>{item.libraryName}</td>
                    <td>{item.department || "未填写"}</td>
                    <td>{item.publishedYear || "未填写"}</td>
                    <td>{item.category || "未填写"}</td>
                    <td>
                      {item.expiryDate
                        ? item.expiryDate.slice(0, 10)
                        : "未填写"}
                    </td>
                    <td>
                      {item.canPreview ? (
                        <div className="space-y-1">
                          <a
                            className="op-link op-link-primary"
                            href={buildPolicyFileUrl(item.relativePath)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            阅读原文
                          </a>
                          <div className="text-xs text-base-content/60">
                            匹配方式：{item.matchedBy || "文件匹配"}
                          </div>
                          <div className="text-xs text-base-content/60 break-all">
                            路径：{item.relativePath}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-base-content/50">
                          <div>未匹配到原文</div>
                          {item.originalFileName ? (
                            <div>台账原文字段：{item.originalFileName}</div>
                          ) : null}
                          {item.originalFileName ? (
                            <a
                              className="op-link op-link-secondary"
                              href={buildPolicyFileByNameUrl(
                                item.originalFileName,
                                item.libraryName &&
                                  item.libraryName !== "未匹配制度库"
                                  ? item.libraryName
                                  : ""
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              按台账文件名尝试打开原文
                            </a>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-sm">
                        {item.sourceWorkbook || "未识别工作簿"}
                      </div>
                      <div className="text-xs text-base-content/60">
                        {item.sourceSheet || "未识别工作表"}
                        {item.sourceRowNumber
                          ? ` / 第 ${item.sourceRowNumber} 行`
                          : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-base-content/70">
            未查询到符合条件的制度，请调整筛选条件后重试。
          </p>
        )}
      </EnterpriseCard>
    </EnterpriseShell>
  );
};

export default PolicySearch;
