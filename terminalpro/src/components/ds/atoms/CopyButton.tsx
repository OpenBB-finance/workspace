import type React from "react";
import { useState } from "react";
import Icon from "~/components/Icon";
import { sleep } from "../utils";
import { Button, type ButtonProps } from "./Button";
import { Popover } from "./Popover";

export interface CopyButtonProps extends ButtonProps {
  text: string;
}

export function CopyButton(props: CopyButtonProps) {
  const { text, onClick, ...buttonProps } = props;

  const [open, setOpen] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e);
    try {
      await navigator.clipboard.writeText(text);
      setOpen(true);
      await sleep(1000);
      setOpen(false);
    } catch (err) {
      console.error("CopyButton error:", err);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen} content="Copied" className="min-w-auto">
      <Button
        size="sm"
        variant="secondary"
        icon={true}
        aria-label="Copy"
        {...buttonProps}
        onClick={handleClick}
      >
        <Icon id="copy-03" />
      </Button>
    </Popover>
  );
}
CopyButton.displayName = "CopyButton";
