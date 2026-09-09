import type { SVGComponent } from "~/types/general.type";

const BookIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 24 24"
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3ZM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default BookIcon;
