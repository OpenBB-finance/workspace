import type * as React from "react";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import Tooltip from "../../Tooltip";

interface RightSideIconButtonProps {
  tooltipMessage: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  buttonVariant?: "warning" | "primary" | "secondary" | "outlined" | "danger";
}

const RightSideIconButton = ({
  tooltipMessage,
  onClick,
  disabled = false,
  children,
  buttonVariant = "secondary",
}: RightSideIconButtonProps) => {
  return (
    <Tooltip message={tooltipMessage}>
      <Button
        onClick={onClick}
        disabled={disabled}
        size="xs"
        variant={buttonVariant}
        className="w-6 h-6 p-0"
      >
        {children}
      </Button>
    </Tooltip>
  );
};

const IconComponent = ({ id }: { id: IconId }) => (
  <Icon id={id} className="w-3.5 h-3.5" />
);

RightSideIconButton.Icon = IconComponent;

export default RightSideIconButton;
