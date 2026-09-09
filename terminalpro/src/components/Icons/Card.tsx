import type { SVGComponent } from "~/types/general.type";

const CardIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
    <g
      clipPath="url(#a231321321)"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2.667H2C1.263 2.667.667 3.263.667 4v8c0 .736.596 1.333 1.333 1.333h12c.736 0 1.333-.597 1.333-1.333V4c0-.737-.597-1.333-1.333-1.333ZM.667 6.667h14.666" />
    </g>
    <defs>
      <clipPath id="a231321321">
        <path fill="currentColor" d="M0 0h16v16H0z" />
      </clipPath>
    </defs>
  </svg>
);

export default CardIcon;
