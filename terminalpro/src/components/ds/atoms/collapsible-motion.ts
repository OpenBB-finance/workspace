export const collapsibleVariants = {
  exit: { opacity: 0, height: 0 },
  enter: { opacity: 1, height: "auto" },
};

export const motionElemProps = {
  initial: collapsibleVariants.exit,
  style: { overflow: "hidden" as const },
  variants: collapsibleVariants,
};
