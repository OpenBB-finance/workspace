import type { SVGProps } from "react";

export const DecreaseFontSizeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.667 6h4M5.333 4.667l-4 8.666M5.333 4.667l4 8.666M3 10h4.667"
    />
  </svg>
);

export const IncreaseFontSizeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12.667 4v4M10.667 6h4M6 2.667 1.333 13.333M6 2.667l4.667 10.666M3.333 9.333h5.334"
    />
  </svg>
);

export function IconParkOutlineExperiment(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 48 48"
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth="4">
        <path strokeLinecap="round" d="M12 4h24" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m10.777 30l7.242-14.961V4h12.01v11.039L37.245 30"
        />
        <path
          strokeLinejoin="round"
          d="M7.794 43.673a3.273 3.273 0 0 1-1.52-4.372L10.777 30S18 35 24 30c6-5 13.246 0 13.246 0l4.49 9.305A3.273 3.273 0 0 1 38.787 44H9.22c-.494 0-.981-.112-1.426-.327Z"
        />
      </g>
    </svg>
  );
}

export const FolderClosed = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M1.333 12.667V3.333A1.333 1.333 0 0 1 2.667 2H6l1.333 2H13.5a1.333 1.333 0 0 1 1.333 1.333v3.334"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M14.443 13.642c.25-.23.39-.54.39-.864V7.722c0-.324-.14-.635-.39-.864-.25-.23-.59-.358-.943-.358H2.667c-.354 0-.693.129-.943.358-.25.23-.39.54-.39.864v5.056c0 .324.14.635.39.864.25.23.59.358.943.358H13.5c.354 0 .693-.129.943-.358Z"
    />
  </svg>
);

export const FolderOpened = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#dwaokioduu213)"
    >
      <path d="M1.333 12.667V3.333A1.333 1.333 0 0 1 2.667 2H6l1.333 2H12a1.333 1.333 0 0 1 1.333 1.333v1.334" />
      <path d="M14.276 13.642c.25-.23.39-.54.39-.864l.667-4.889c0-.324-.14-.635-.39-.864-.25-.23-.59-.358-.943-.358H3.333c-.353 0-.692.129-.942.358-.25.229-.391.54-.391.864l-.667 4.889c0 .324.14.635.39.864.251.23.59.358.944.358h10.666c.354 0 .693-.129.943-.358Z" />
    </g>
    <defs>
      <clipPath id="dwaokioduu213">
        <path fill="currentColor" d="M0 0h16v16H0z" />
      </clipPath>
    </defs>
  </svg>
);
export const CollapseLeft = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12.667 2H3.333C2.597 2 2 2.597 2 3.333v9.334C2 13.403 2.597 14 3.333 14h9.334c.736 0 1.333-.597 1.333-1.333V3.333C14 2.597 13.403 2 12.667 2Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M 9 10.667 L 6 8 L 9 5.333"
    />
  </svg>
);

export const CollapseRight = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12.667 2H3.333C2.597 2 2 2.597 2 3.333v9.334C2 13.403 2.597 14 3.333 14h9.334c.736 0 1.333-.597 1.333-1.333V3.333C14 2.597 13.403 2 12.667 2Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M 8 11 L 11 8 L 8 5"
    />
  </svg>
);

export const FolderIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M14.667 12.667A1.333 1.333 0 0 1 13.334 14H2.667a1.334 1.334 0 0 1-1.333-1.333V3.333A1.333 1.333 0 0 1 2.667 2H6l1.333 2h6a1.333 1.333 0 0 1 1.334 1.333v7.334Z"
    />
  </svg>
);

export const FileIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8.666 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.668h8a1.333 1.333 0 0 0 1.333-1.333V6L8.666 1.333Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8.666 1.333V6h4.667"
    />
  </svg>
);

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M2 6l6-4.667L14 6v7.334a1.333 1.333 0 01-1.333 1.333H3.333A1.333 1.333 0 012 13.334V6z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6 14.667V8h4v6.667"
      />
    </svg>
  );
}

export function MaterialSymbols123(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M5.5 15v-4.5H4V9h3v6H5.5ZM9 15v-2.5q0-.425.288-.713T10 11.5h2v-1H9V9h3.5q.425 0 .713.288T13.5 10v1.5q0 .425-.288.713t-.712.287h-2v1h3V15H9Zm6 0v-1.5h3v-1h-2v-1h2v-1h-3V9h3.5q.425 0 .713.288T19.5 10v4q0 .425-.288.713T18.5 15H15Z"
      />
    </svg>
  );
}

export function IcOutlineLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"
      />
    </svg>
  );
}

export function IcBaselineFolderOpen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="currentColor"
        d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"
      />
    </svg>
  );
}
