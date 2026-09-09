import { LinkProps, Link as RouterLink } from "react-router-dom";
import { twMerge } from "tailwind-merge";

export default function Link(props: LinkProps) {
  const { className, target: _target, rel: _rel, ...rest } = props;
  const isExternal = props.to?.toString().includes("://");
  const target = _target ?? (isExternal ? "_blank" : undefined);
  const rel = _rel ?? (isExternal ? "noopener noreferrer" : undefined);

  return (
    <RouterLink
      className={twMerge("link", className)}
      target={target}
      rel={rel}
      {...rest}
    />
  );
}
