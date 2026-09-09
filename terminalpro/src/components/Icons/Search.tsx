import type { SVGComponent } from "~/types/general.type";

const SearchIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 18 18"
    width={18}
    height={18}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      strokeWidth={1.5}
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.75 8.083a5.333 5.333 0 1 0 10.667 0 5.333 5.333 0 0 0-10.667 0Zm-2 0a7.333 7.333 0 0 0 11.764 5.845l3.112 3.112a1 1 0 1 0 1.415-1.414l-3.113-3.112A7.333 7.333 0 1 0 .75 8.084Z"
      fill="currentColor"
    />
  </svg>
);

export default SearchIcon;
