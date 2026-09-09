import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { lazy, Suspense, useEffect, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { getEntityRoleActivityLog } from "~/api/entity_roles.api";
import type { DataTableColumn } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import { useStateReducer } from "~/hooks/useStateReducer";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { Select } from "../ds/atoms/Select";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { RangeDatePicker } from "./RangeDatePicker";

const MarkdownContent = lazy(() =>
  import("../Widgets/custom/Markdown").then((module) => ({
    default: module.MarkdownContent,
  })),
);

const convertToMarkdown = (obj, level = 0) => {
  if (typeof obj !== "object" || obj === null) {
    return `${JSON.stringify(obj)}\n`;
  }

  let markdown = "";
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const indent = "  ".repeat(level);

      if (Array.isArray(value)) {
        markdown += `${indent}- **${key}**: \n`;
        value.forEach((item) => {
          markdown += convertToMarkdown(item, level + 2);
        });
      } else if (typeof value === "object") {
        markdown += `${indent}- **${key}**:\n`;
        markdown += convertToMarkdown(value, level + 1);
      } else if (key === "access") {
        markdown += `${indent}  - ${key}: ${JSON.stringify(value)}\n`;
      } else {
        markdown += `${indent}- **${key}**: ${JSON.stringify(value)}\n`;
      }
    }
  }
  return markdown;
};

export function ActivityLogPage() {
  const {
    data: activityLog = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["activityLog"] as const,
    queryFn: getEntityRoleActivityLog,
    enabled: true,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });

  useEffect(() => {
    refetch();
  }, []);

  const [state, dispatch] = useStateReducer({
    searchTerm: "",
    selectedRole: "All roles",
    selectedMember: "All members",
    selectedActivity: "All activities",
    dateRange: undefined as DateRange | undefined,
    currentPage: 1,
    itemsPerPage: 10,
  });

  const { uniqueRoles, uniqueMembers, uniqueActivities } = useMemo(() => {
    const uniqueData = activityLog.reduce(
      (acc, entry) => {
        acc.roles.add(entry.role);
        acc.members.add(entry.performedBy);
        acc.activities.add(entry.activityType);
        return acc;
      },
      {
        roles: new Set<string>(),
        members: new Set<string>(),
        activities: new Set<string>(),
      },
    );

    return {
      uniqueRoles: ["All roles", ...uniqueData.roles],
      uniqueMembers: ["All members", ...uniqueData.members],
      uniqueActivities: ["All activities", ...uniqueData.activities],
    };
  }, [activityLog]);

  const filteredActivityLog = useMemo(() => {
    return activityLog.filter((entry) => {
      const matchesSearch =
        entry.role.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        entry.performedBy.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        entry.detailsMsg?.toLowerCase().includes(state.searchTerm.toLowerCase());

      const matchesRole =
        state.selectedRole === "All roles" || entry.role === state.selectedRole;
      const matchesMember =
        state.selectedMember === "All members" ||
        entry.performedBy === state.selectedMember;
      const matchesActivity =
        state.selectedActivity === "All activities" ||
        entry.activityType === state.selectedActivity;

      const entryDate = new Date(entry.timestamp);
      const matchesDateRange =
        (!state.dateRange?.from || entryDate >= state.dateRange.from) &&
        (!state.dateRange?.to || entryDate <= state.dateRange.to);

      return (
        matchesSearch &&
        matchesRole &&
        matchesMember &&
        matchesActivity &&
        matchesDateRange
      );
    });
  }, [
    activityLog,
    state.searchTerm,
    state.selectedRole,
    state.selectedMember,
    state.selectedActivity,
    state.dateRange,
  ]);

  const paginatedActivityLog = useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    return filteredActivityLog.slice(startIndex, endIndex);
  }, [filteredActivityLog, state.currentPage, state.itemsPerPage]);

  const totalPages = Math.ceil(filteredActivityLog.length / state.itemsPerPage);

  type ActivityEntry = (typeof activityLog)[number];
  const columns = useMemo<DataTableColumn<ActivityEntry>[]>(
    () => [
      {
        id: "role",
        header: "Role",
        width: "15%",
        minWidth: 120,
        cell: (entry) => <span className="body-xs-medium">{entry.role}</span>,
      },
      {
        id: "performedBy",
        header: "Performed by",
        width: "20%",
        minWidth: 150,
        cell: (entry) => entry.performedBy,
      },
      {
        id: "activityType",
        header: "Activity type",
        width: "16%",
        minWidth: 130,
        truncate: false,
        cell: (entry) => (
          <span
            className={cn(
              "px-2 py-1 rounded text-xs whitespace-nowrap",
              getActivityTypeStyle(entry.activityType),
            )}
          >
            {entry.activityType.replace(/-/g, " ")}
          </span>
        ),
      },
      {
        id: "timestamp",
        header: "Timestamp",
        width: "19%",
        minWidth: 150,
        cell: (entry) => dayjs(entry.timestamp).format("YYYY-MM-DD HH:mm:ss A"),
      },
      {
        id: "details",
        header: "Details",
        width: "30%",
        minWidth: 160,
        truncate: false,
        cell: (entry) => (
          <Tooltip
            position="top"
            message={
              <div className="max-h-[300px] max-w-[400px] overflow-auto flex flex-col p-1.5 pb-4 prose dark:prose-invert prose-sm text-xs! prose-p:my-0.5">
                <Suspense fallback={null}>
                  <MarkdownContent content={convertToMarkdown(entry.details)} />
                </Suspense>
              </div>
            }
          >
            <span className="cursor-help">{entry.detailsMsg}</span>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  if (isLoading) return <LoadingActivityLog />;
  if (error) return <ErrorActivityLog />;

  return (
    <TabsPrimitive.Content
      value="activity-log"
      className="p-6 text-sm only-sm:h-screen"
    >
      <div className="flex items-center gap-[10px] flex-wrap">
        <Input
          size="xs"
          className="min-w-[270px] h-8 [&_input]:h-8"
          placeholder="Search activities"
          prefix={<Icon id="search" />}
          clearable={true}
          value={state.searchTerm}
          onChange={(value) => dispatch({ searchTerm: value.toString() })}
        />
        <div className="flex-1" />
        <RangeDatePicker onRangeSelect={(range) => dispatch({ dateRange: range })} />
        <Select
          value={state.selectedRole}
          onValueChange={(value) => dispatch({ selectedRole: value })}
          options={uniqueRoles.map((role) => ({ label: role, value: role }))}
          className="w-[150px]"
        />
        <Select
          value={state.selectedMember}
          onValueChange={(value) => dispatch({ selectedMember: value })}
          options={uniqueMembers.map((member) => ({
            label: member,
            value: member,
          }))}
          className="w-[150px]"
        />
        <Select
          value={state.selectedActivity}
          onValueChange={(value) => dispatch({ selectedActivity: value })}
          options={uniqueActivities.map((activity) => ({
            label: activity,
            value: activity,
          }))}
          className="w-[150px]"
        />
      </div>

      <DataTable
        className="mt-6"
        columns={columns}
        data={paginatedActivityLog}
        getRowId={(entry) => entry.uuid}
      />

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-ds-text-caption">
          Showing {Math.min(filteredActivityLog.length, state.itemsPerPage)} of{" "}
          {filteredActivityLog.length} entries
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dispatch({ currentPage: state.currentPage - 1 })}
            disabled={state.currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {state.currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dispatch({ currentPage: state.currentPage + 1 })}
            disabled={state.currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </TabsPrimitive.Content>
  );
}

const getActivityTypeStyle = (type: string) => {
  if (type.includes("role")) {
    return "bg-tag-orange-bg text-tag-orange-label";
  }
  if (type.includes("backend") || type.includes("file") || type.includes("prompt")) {
    return "bg-tag-purple-bg text-tag-purple-label";
  }
  if (type.includes("user")) {
    return "bg-tag-blue-bg text-tag-blue-label";
  }
  return "";
};

function LoadingActivityLog() {
  return (
    <TabsPrimitive.Content
      value="activity-log"
      className="p-6 text-sm only-sm:h-screen"
    >
      <div className="flex h-full items-center justify-center py-20">
        <BrandedLoadingState />
      </div>
    </TabsPrimitive.Content>
  );
}

function ErrorActivityLog() {
  return (
    <TabsPrimitive.Content
      value="activity-log"
      className="p-6 text-sm only-sm:h-screen"
    >
      <div className="flex items-center justify-center h-full">
        <p className="text-xs">Error loading activity log.</p>
      </div>
    </TabsPrimitive.Content>
  );
}
