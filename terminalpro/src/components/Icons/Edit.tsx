import type { SVGComponent } from "~/types/general.type";

const EditIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 20 21"
    width={20}
    height={21}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="M10 16.866h7.5M13.75 3.116a1.768 1.768 0 0 1 2.5 2.5L5.833 16.033l-3.333.833.833-3.333L13.75 3.116Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default EditIcon;
