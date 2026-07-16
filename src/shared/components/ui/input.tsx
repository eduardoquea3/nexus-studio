import type { ComponentProps } from "react";
import type { RemixiconComponentType } from "@remixicon/react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type InputIcon = RemixiconComponentType;

interface InputProps extends ComponentProps<typeof InputGroupInput> {
  iconLeft?: InputIcon;
  iconRight?: InputIcon;
  iconLeftClick?: () => void;
  iconRightClick?: () => void;
  classIcon?: string;
  classIconLeft?: string;
  classIconRight?: string;
}

function Input({
  iconLeft: LeftIcon,
  iconRight: RightIcon,
  iconLeftClick,
  iconRightClick,
  classIcon,
  classIconLeft,
  classIconRight,
  ...props
}: InputProps) {
  const renderIcon = (Icon: InputIcon, onClick: (() => void) | undefined, className?: string) => {
    if (!onClick) {
      return <Icon className={cn("size-4", className)} aria-hidden="true" />;
    }

    return (
      <InputGroupButton
        size="icon-sm"
        tabIndex={-1}
        aria-label="Edit input"
        className={className}
        onClick={props.disabled ? undefined : onClick}
      >
        <Icon aria-hidden="true" />
      </InputGroupButton>
    );
  };

  return (
    <InputGroup className="h-10">
      {LeftIcon ? (
        <InputGroupAddon>
          {renderIcon(LeftIcon, iconLeftClick, cn(classIconLeft, classIcon))}
        </InputGroupAddon>
      ) : null}
      <InputGroupInput {...props} />
      {RightIcon ? (
        <InputGroupAddon align="inline-end">
          {renderIcon(RightIcon, iconRightClick, cn(classIconRight, classIcon))}
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export { Input, type InputProps };
