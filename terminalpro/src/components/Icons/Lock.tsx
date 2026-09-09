import type { SVGComponent } from "~/types/general.type";

const LockIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 16 16"
    width={16}
    height={16}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="M12.667 7.333H3.333C2.597 7.333 2 7.93 2 8.666v4.667c0 .736.597 1.333 1.333 1.333h9.334c.736 0 1.333-.597 1.333-1.333V8.666c0-.736-.597-1.333-1.333-1.333ZM4.667 7.333V4.666a3.333 3.333 0 0 1 6.667 0v2.667"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default LockIcon;
