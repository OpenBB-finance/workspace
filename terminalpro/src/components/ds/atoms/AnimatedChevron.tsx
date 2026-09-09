import { motion } from "framer-motion";
import Icon from "~/components/Icon";
import { cn } from "../utils";

const variants = { open: { rotate: 90 }, closed: { rotate: 0 } };

interface AnimatedChevronProps {
  isOpen: boolean;
  size?: string;
  className?: string;
}

export function AnimatedChevron({
  isOpen,
  size = "size-4",
  className,
}: AnimatedChevronProps) {
  return (
    <motion.div
      initial={false}
      animate={isOpen ? "open" : "closed"}
      variants={variants}
      transition={{ duration: 0.2 }}
      className={cn("flex-shrink-0", className)}
    >
      <Icon id="chevron-right" className={size} />
    </motion.div>
  );
}
