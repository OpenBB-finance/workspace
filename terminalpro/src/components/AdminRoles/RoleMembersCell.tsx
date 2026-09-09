import { useCallback, useMemo, useRef, useState } from "react";
import { UNIQUE_AVATAR_COLORS } from "~/lib/constants";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../ds/atoms/Popover";
import { getUserInitials } from "./AddUsersSelect";
import { useUsers } from "./adminUseQueries";
import type { RoleT } from "./types";

interface Props {
  role: RoleT;
}

export default function RoleMembersCell({ role }: Props) {
  const { data: users, isLoading } = useUsers();
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const handleOpen = useCallback(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  }, [closeTimeoutRef]);

  const handleClose = useCallback(() => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 150); // Small delay to allow mouse movement between trigger and content
  }, [closeTimeoutRef]);

  const { formattedUsers, displayUsers, remainingCount } = useMemo(() => {
    if (!users) return { formattedUsers: [], displayUsers: [], remainingCount: 0 };

    const roleUsers = users.filter((user) => role.users.includes(user.email));

    const formattedUsers = roleUsers.map((user) => ({
      email: user.email,
      name: user.fullName,
      color:
        UNIQUE_AVATAR_COLORS[user.email.charCodeAt(0) % UNIQUE_AVATAR_COLORS.length],
      initials: getUserInitials(user.fullName) || user.email.slice(0, 2).toUpperCase(),
    }));

    const displayUsers = formattedUsers.slice(0, 3);
    const remainingUsers = formattedUsers.slice(3);
    const remainingCount = remainingUsers.length;
    return { formattedUsers, displayUsers, remainingCount };
  }, [users, role]);

  if (isLoading || !users) return null;

  return (
    <div className="flex items-center">
      {formattedUsers.length === 0 ? (
        <span className="text-ds-text-body">0</span>
      ) : (
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
            onClick={() => setOpen(true)}
            className="flex -space-x-2 mr-2 cursor-pointer"
          >
            {displayUsers.map((user) => (
              <div
                key={user.email}
                className="obb-avatar-user"
                style={{
                  backgroundColor: user.color,
                }}
                title={user.email}
              >
                {user.initials}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium bg-light-500 dark:bg-dark-500 border-2 border-white dark:border-dark-800">
                +{remainingCount}
              </div>
            )}
          </PopoverTrigger>
          <PopoverContent
            className="p-3 max-h-60 max-w-[600px] bg-general-bg-secondary"
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
          >
            <div className="space-y-1.5">
              <p className="text-ds-text-caption uppercase tracking-wide text-[8px]">
                Role Members ({formattedUsers.length})
              </p>
              <div className="max-h-[195px] flex flex-col gap-1.5 bg-general-bg-secondary p-1.5 pr-6 rounded overflow-y-auto">
                {formattedUsers.map((user) => (
                  <div
                    key={user.email}
                    className="flex items-center gap-2 body-xs-regular"
                  >
                    <div
                      className="obb-avatar-user"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="">{user.name}</span>
                      <span className="text-2xs text-ds-text-caption">
                        {user.email}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </PopoverRoot>
      )}
    </div>
  );
}
