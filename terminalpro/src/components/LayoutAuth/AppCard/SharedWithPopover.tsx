import { memo } from "react";
import { getUserInitials } from "~/components/AdminRoles/AddUsersSelect";
import { HoverPopover } from "~/components/HoverPopover";
import Icon from "~/components/Icon";
import { UNIQUE_AVATAR_COLORS as COLORS } from "~/lib/constants";
import type { SharedUser } from "~/lib/state/userApps";

interface SharedWithPopoverProps {
  sharedUsers?: SharedUser[];
  id: string;
}

export const SharedWithPopover = memo(({ sharedUsers, id }: SharedWithPopoverProps) => {
  if (!sharedUsers || sharedUsers.length === 0) return null;

  const displayInitials = sharedUsers[0]?.name
    ? getUserInitials(sharedUsers[0].name)
    : String(sharedUsers.length);

  return (
    <HoverPopover
      contentClassName="pr-2.5 max-h-[300px] w-[250px] overflow-y-auto"
      id={`shared-with-${id}`}
      side="top"
      onClick={(e) => e.stopPropagation()}
      triggerClassName="flex items-center gap-1"
      trigger={
        <>
          <Icon id="user-icon" className="size-3.5 text-ds-text-body" />
          <span className="text-2xs text-alert-warning font-medium uppercase">
            {displayInitials}
          </span>
        </>
      }
      content={
        <>
          <p className="obb-uppercase-small-title mb-1.5 text-ds-text-caption pb-1.5 border-b border-surface-divider">
            Shared with
          </p>
          <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
            {sharedUsers.map((user, idx) => {
              const initials = getUserInitials(user.name);
              return (
                <div
                  key={`shared-user-${user.email}`}
                  className="flex items-center gap-2 text-ds-text-body py-1"
                >
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-base-0 text-xs font-medium shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  >
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate">{user.name}</span>
                    <span className="text-2xs text-ds-text-caption truncate">
                      {user.email}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      }
    />
  );
});
