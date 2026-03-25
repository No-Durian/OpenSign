import { useEffect, useMemo, useState } from "react";
import EnterpriseShell, {
  EnterpriseCard
} from "../../components/enterprise/EnterpriseShell";
import {
  fetchPolicyMessages,
  postPolicyMessage
} from "../../constant/enterpriseApi";
import Loader from "../../primitives/Loader";

const role = localStorage.getItem("_user_role") || "";
const isAdmin = [
  "Admin",
  "OrgAdmin",
  "contracts_Admin",
  "contracts_OrgAdmin"
].includes(role);

const PolicyMessageBoard = () => {
  const [form, setForm] = useState({
    author: localStorage.getItem("username") || "",
    department: localStorage.getItem("TenantName") || "",
    content: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const description = useMemo(
    () =>
      isAdmin
        ? "普通用户可留言提出建议，仅管理员可查看全部留言。"
        : "请填写您的建议或制度优化需求，提交后由管理员在后台统一查看。",
    []
  );

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchPolicyMessages(role)
      .then((data) => {
        if (active) setMessages(data);
      })
      .catch((err) => {
        if (active)
          setError(
            err?.response?.data?.message || err.message || "读取留言失败"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submitMessage = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    setError("");
    try {
      const saved = await postPolicyMessage(form);
      setNotice("留言已提交，管理员稍后会查看。");
      setForm((prev) => ({ ...prev, content: "" }));
      if (isAdmin) {
        setMessages((prev) => [saved, ...prev]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "提交留言失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EnterpriseShell title="制度留言板" description={description}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <EnterpriseCard title="提出建议">
          <form className="space-y-4" onSubmit={submitMessage}>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">留言人</span>
              <input
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={form.author}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, author: event.target.value }))
                }
              />
            </label>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">部门</span>
              <input
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={form.department}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    department: event.target.value
                  }))
                }
              />
            </label>
            <label className="form-control gap-2">
              <span className="text-sm font-medium">建议内容</span>
              <textarea
                className="min-h-[180px] w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                value={form.content}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder="请输入希望新增、修订或优化的制度建议。"
              />
            </label>
            {notice ? <p className="text-sm text-success">{notice}</p> : null}
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <button
              className="op-btn op-btn-primary"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "提交中..." : "提交留言"}
            </button>
          </form>
        </EnterpriseCard>

        <EnterpriseCard
          title="管理员留言查看区"
          subtitle="仅管理员可查看全部留言记录。"
        >
          {isAdmin ? (
            loading ? (
              <div className="h-[200px] flex justify-center items-center">
                <Loader />
              </div>
            ) : messages.length ? (
              <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-xl border border-base-300 p-4"
                  >
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-semibold">
                        {message.author || "匿名用户"}
                      </span>
                      <span className="text-base-content/60">
                        {message.createdAt
                          ? message.createdAt.replace("T", " ").slice(0, 16)
                          : ""}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/60 mt-1">
                      部门：{message.department || "未填写"}
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-base-content/70">暂无留言。</p>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-base-300 p-6 text-sm text-base-content/70">
              您当前为普通用户，仅能提交留言；全部留言列表仅管理员可见。
            </div>
          )}
        </EnterpriseCard>
      </div>
    </EnterpriseShell>
  );
};

export default PolicyMessageBoard;
