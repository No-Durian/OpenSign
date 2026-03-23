const EnterpriseShell = ({ title, description, actions, children }) => {
  return (
    <section className="space-y-4">
      <div className="op-card bg-base-100 shadow-md p-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-base-content">{title}</h1>
          {description ? (
            <p className="text-sm text-base-content/70 mt-2 whitespace-pre-line">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
};

export const EnterpriseCard = ({
  title,
  subtitle,
  children,
  className = ""
}) => {
  return (
    <article className={`op-card bg-base-100 shadow-md p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-base-content">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-base-content/70 mt-1 whitespace-pre-line">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </article>
  );
};

export default EnterpriseShell;
