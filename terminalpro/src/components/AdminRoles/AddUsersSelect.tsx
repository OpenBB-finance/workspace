import { useCallback, useMemo, useRef } from "react";
import { useStateReducer } from "~/hooks/useStateReducer";
import { UNIQUE_AVATAR_COLORS } from "~/lib/constants";
import { Checkbox } from "../ds/atoms/Checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import { Input } from "../ds/atoms/Input";
import { cn } from "../ds/utils";
import Icon from "../Icon";

interface User {
  name: string;
  email: string;
}

export function getUserInitials(name: string) {
  if (!name) return "";
  const nameParts = name.split(" ");
  return (
    nameParts[0].charAt(0) +
    (nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0) : "")
  );
}

export function colorForEmail(email: string) {
  return UNIQUE_AVATAR_COLORS[email.charCodeAt(0) % UNIQUE_AVATAR_COLORS.length];
}

interface Props {
  value?: string[];
  onChange?: (value: string[]) => void;
  entityUsers?: User[];
  isLoading?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function AddUsersSelect({
  value = [],
  onChange,
  entityUsers = [],
  isLoading = false,
  onOpenChange: externalOnOpenChange,
}: Props) {
  const [state, dispatch] = useStateReducer({
    searchQuery: "",
    isOpen: false,
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredUsers = useMemo(
    () =>
      entityUsers.filter((user) =>
        user?.name?.toLowerCase()?.includes(state.searchQuery.toLowerCase()),
      ),
    [entityUsers, state.searchQuery],
  );

  const filteredEmailSet = useMemo(
    () => new Set(filteredUsers.map((u) => u.email)),
    [filteredUsers],
  );

  const filteredSelectedCount = useMemo(
    () => filteredUsers.reduce((n, u) => n + (value.includes(u.email) ? 1 : 0), 0),
    [filteredUsers, value],
  );

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredSelectedCount === filteredUsers.length;
  const someFilteredSelected = filteredSelectedCount > 0 && !allFilteredSelected;
  const selectAllChecked: boolean | "indeterminate" = someFilteredSelected
    ? "indeterminate"
    : allFilteredSelected;

  const handleUserSelect = useCallback(
    (user: User) => {
      const next = value.includes(user.email)
        ? value.filter((email) => email !== user.email)
        : [...value, user.email];
      onChange?.(next);
    },
    [value, onChange],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      onChange?.(
        checked
          ? Array.from(new Set([...value, ...filteredEmailSet]))
          : value.filter((email) => !filteredEmailSet.has(email)),
      );
    },
    [filteredEmailSet, onChange, value],
  );

  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      dispatch({ isOpen, searchQuery: "" });
      externalOnOpenChange?.(isOpen);
    },
    [dispatch, externalOnOpenChange],
  );

  const onInputChange = useCallback(
    (searchQuery: string) => {
      dispatch({ searchQuery });
      if (inputRef.current) {
        inputRef.current.value = searchQuery;
      }
    },
    [dispatch],
  );

  const selectedCount = value.length;
  const triggerLabel =
    selectedCount === 0
      ? "Add members"
      : `${selectedCount} ${selectedCount === 1 ? "member" : "members"} selected`;

  return (
    <DropdownMenu open={state.isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        disabled={isLoading}
        className={cn(
          "h-8 body-xs-regular p-2 flex w-full items-center justify-between rounded-sm border [&>span]:line-clamp-1 transition border-light-200 bg-white text-light-900 data-[placeholder]:text-light-500 hover:enabled:text-light-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-300 disabled:cursor-not-allowed disabled:border-light-200 disabled:bg-light-200 disabled:text-light-400 disabled:data-[placeholder]:text-light-400 dark:border-dark-600 dark:bg-dark-800 dark:text-light-50 dark:data-[placeholder]:text-light-500 dark:hover:enabled:border-dark-400 dark:hover:enabled:bg-dark-600 dark:hover:enabled:text-light-300 dark:focus-visible:ring-dark-50 dark:disabled:border-dark-750 dark:disabled:bg-dark-800 dark:disabled:text-dark-400 dark:disabled:data-[placeholder]:text-dark-400 gap-2",
        )}
      >
        {isLoading ? "Loading users…" : triggerLabel}
        <Icon id="chevron-down" className="BB-Icon block size-4 text-ds-text-body" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(
          "relative z-50 max-h-[240px] min-w-[417.7px] w-full overflow-hidden rounded-md shadow-md",
          "bg-general-bg-secondary",
          "p-2.5",
        )}
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <Input
          ref={(el) => (inputRef.current = el)}
          prefix={<Icon id="search" />}
          placeholder="Search users"
          defaultValue={state.searchQuery}
          onChange={onInputChange}
        />
        <div className="my-2.5 flex justify-between items-center">
          <p className="text-2xs text-ds-text-caption uppercase tracking-wide">
            USERS FROM THE ORGANIZATION ({entityUsers.length})
          </p>
          <Checkbox
            label="Select all"
            labelClassName="whitespace-nowrap"
            checked={selectAllChecked}
            onCheckedChange={(c) => handleSelectAll(c === true)}
            disabled={filteredUsers.length === 0}
          />
        </div>
        <hr />
        <div className="flex flex-col gap-2.5 mt-2.5 text-2xs max-h-[calc(240px-100px)] overflow-y-auto">
          {isLoading ? (
            <p role="status" className="text-ds-text-caption body-xs-regular py-2">
              Loading users…
            </p>
          ) : filteredUsers.length === 0 ? (
            <p role="status" className="text-ds-text-caption body-xs-regular py-2">
              {state.searchQuery ? "No users found" : "No users in this organization"}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const initials = getUserInitials(user.name);
              return (
                <div
                  key={`user-${user.email}`}
                  className="flex items-center gap-2.5 cursor-pointer justify-between pr-3"
                >
                  <div
                    className="flex items-center gap-2.5 flex-1"
                    onClick={() => handleUserSelect(user)}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full text-white",
                      )}
                      style={{
                        backgroundColor: colorForEmail(user.email),
                      }}
                    >
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-general-label">
                        {user.name}
                      </span>
                      <span className="text-ds-text-caption">{user.email}</span>
                    </div>
                  </div>
                  <Checkbox
                    checked={value.includes(user.email)}
                    onCheckedChange={() => handleUserSelect(user)}
                  />
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
