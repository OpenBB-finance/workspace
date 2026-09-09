import type { SVGComponent } from "~/types/general.type";

const WalletIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
      d="M13.333 10.667v2.666a.667.667 0 0 1-.666.667h-10A.667.667 0 0 1 2 13.333v-8a.667.667 0 0 1 .667-.666h10a.667.667 0 0 1 .666.666V8"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.333 8h-2a.667.667 0 0 0-.667.667V10c0 .368.299.667.667.667h2A.667.667 0 0 0 14 10V8.667A.667.667 0 0 0 13.333 8ZM4 4.667 9.42 2.26a.667.667 0 0 1 .867.307l1.046 2.1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default WalletIcon;
