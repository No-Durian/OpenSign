import React from "react";

const placeholders = [
  "fa-brands fa-github",
  "fa-brands fa-linkedin",
  "fa-brands fa-square-x-twitter",
  "fa-brands fa-discord"
];

const SocialMedia = () => {
  return (
    <React.Fragment>
      {placeholders.map((icon) => (
        <span
          key={icon}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-base-300 text-base-content/40"
          aria-hidden="true"
          title="预留外部链接位置"
        >
          <i className={icon}></i>
        </span>
      ))}
    </React.Fragment>
  );
};

export default SocialMedia;
