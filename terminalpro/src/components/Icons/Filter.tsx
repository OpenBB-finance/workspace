function FilterIcon({ ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        clipPath="url(#clip0_1720_23627)"
      >
        <path d="M2.667 14V9.333M2.667 6.667V2M8 14V8M8 5.333V2M13.333 14v-3.333M13.333 8V2M.667 9.333h4M6 5.333h4M11.333 10.667h4" />
      </g>
      <defs>
        <clipPath id="clip0_1720_23627">
          <path fill="#fff" d="M0 0H16V16H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

export default FilterIcon;
