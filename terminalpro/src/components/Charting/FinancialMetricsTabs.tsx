import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { useState } from "react";
import CheckIcon from "../Icons/Check";
import { CHARTING_COLORS, FINANCIAL_METRICS } from "./constants";

export default function FinancialMetricsTabs({
  filter,
  selectedMetrics,
  setSelectedMetrics,
}: {
  filter: string;
  selectedMetrics: any[];
  setSelectedMetrics: (metrics: any[]) => void;
}) {
  const [prevColor, setPrevColor] = useState("");

  function getSecurityColor() {
    if (!prevColor) {
      setPrevColor(CHARTING_COLORS[0]);
      return CHARTING_COLORS[0];
    }
    const prevIndex = CHARTING_COLORS.indexOf(prevColor);
    const index = prevIndex >= CHARTING_COLORS.length - 1 ? 0 : prevIndex + 1;
    const color = CHARTING_COLORS[index];
    setPrevColor(color);
    return color;
  }
  return (
    <TabsPrimitive.Root
      defaultValue={"income-statement"}
      orientation="vertical"
      className="mt-3 text-xs px-5"
    >
      <TabsPrimitive.List className="flex gap-3 mb-3">
        <TabsPrimitive.Trigger
          value="all"
          className="uppercase px-3 py-1.5 rounded-[100px] radix-state-active:bg-brand-main radix-state-inactive:bg-[#e0e3eb] radix-state-inactive:text-light-900 radix-state-active:text-white dark:radix-state-inactive:text-[#808495] dark:radix-state-inactive:bg-[#2a2e39]"
        >
          All
        </TabsPrimitive.Trigger>
        {Object.keys(FINANCIAL_METRICS).map((key) => (
          <TabsPrimitive.Trigger
            value={key}
            key={key}
            className="uppercase px-3 py-1.5 rounded-[100px] radix-state-active:bg-brand-main radix-state-inactive:bg-[#e0e3eb] radix-state-inactive:text-light-900 radix-state-active:text-white dark:radix-state-inactive:text-[#808495] dark:radix-state-inactive:bg-[#2a2e39]"
          >
            {FINANCIAL_METRICS[key].label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      <TabsPrimitive.Content
        value="all"
        className="radix-state-inactive:hidden flex flex-col h-[calc(100vh-400px)] overflow-y-auto"
      >
        {Object.keys(FINANCIAL_METRICS).map((key) => (
          <div key={key}>
            <p className="px-2.5 py-2 text-[#808495] uppercase font-bold">
              {FINANCIAL_METRICS[key].label}
            </p>
            {FINANCIAL_METRICS?.[key]?.children
              ?.filter((child) =>
                child.children?.some((grandChild) =>
                  grandChild.label.toLowerCase().includes(filter.toLowerCase()),
                ),
              )
              .map((child) => (
                <div key={child.id}>
                  <p className="px-2.5 py-2 text-[#808495] uppercase">{child.label}</p>
                  {child?.children
                    ?.filter((grandChild) =>
                      grandChild.label.toLowerCase().includes(filter.toLowerCase()),
                    )
                    .map((grandChild) => (
                      <div
                        onClick={() => {
                          if (
                            selectedMetrics?.find((item) => item.id === grandChild.id)
                          ) {
                            setSelectedMetrics(
                              selectedMetrics?.map((item) => {
                                if (item.id === grandChild.id) {
                                  return {
                                    ...item,
                                    active: !item.active,
                                    newPane:
                                      item.newPane === undefined
                                        ? "newPane"
                                        : item.newPane,
                                    prevPane: item.newPane,
                                  };
                                }
                                return item;
                              }),
                            );
                          } else {
                            setSelectedMetrics([
                              ...selectedMetrics,
                              {
                                ...grandChild,
                                label: key,
                                color: getSecurityColor(),
                                active: true,
                                newPane: "newPane",
                                prevPane: "newPane",
                              },
                            ]);
                          }
                        }}
                        className="group px-2.5 py-2 rounded flex items-center justify-between w-full dark:hover:bg-[#24242A] hover:bg-[#f0f3fa] cursor-pointer"
                        key={grandChild.id}
                      >
                        <span className="flex flex-col items-start">
                          <span className="font-bold">{grandChild.label}</span>
                          <span className="text-light-500 dark:text-light-300">
                            {grandChild.description}
                          </span>
                        </span>
                        <div className="flex gap-3 items-center">
                          <ToggleGroupPrimitive.Root
                            type="single"
                            value={
                              selectedMetrics?.find((item) => item.id === grandChild.id)
                                ?.period || "annual"
                            }
                            onValueChange={(value) =>
                              value &&
                              setSelectedMetrics([
                                ...(selectedMetrics?.filter(
                                  (item) => item.id !== grandChild.id,
                                ) || []),
                                {
                                  ...(selectedMetrics?.find(
                                    (item) => item.id === grandChild.id,
                                  ) || {
                                    ...grandChild,
                                    label: key,
                                    color: getSecurityColor(),
                                  }),
                                  active: true,
                                  period: value,
                                },
                              ])
                            }
                            defaultValue="annual"
                            className="gap-1 hidden group-hover:flex"
                          >
                            {["annual", "quarterly"].map((value) => (
                              <ToggleGroupPrimitive.Item
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                key={value}
                                value={value.replace("ly", "")}
                                className="px-2 py-1 capitalize font-medium radix-state-on:bg-[#CCDEEE] dark:radix-state-on:bg-[#46464F] radix-state-off:bg-white dark:radix-state-off:bg-[#2A2A31] whitespace-nowrap text-xs rounded text-[#808495] dark:text-white"
                              >
                                {value}
                              </ToggleGroupPrimitive.Item>
                            ))}
                          </ToggleGroupPrimitive.Root>
                          <ToggleGroupPrimitive.Root
                            type="single"
                            className="hidden group-hover:flex ml-2"
                            value={
                              selectedMetrics?.find((item) => item.id === grandChild.id)
                                ?.newPane || "newPane"
                            }
                            onValueChange={(value) => {
                              const newPane =
                                value === "newPane" ? "newPane" : "inChart";
                              const prevMetric = selectedMetrics?.find(
                                (item) => item.id === grandChild.id,
                              );
                              setSelectedMetrics([
                                ...(selectedMetrics?.filter(
                                  (item) => item.id !== grandChild.id,
                                ) || []),
                                {
                                  ...(prevMetric || {
                                    ...grandChild,
                                    label: key,
                                    color: getSecurityColor(),
                                  }),
                                  active: true,
                                  prevPane: prevMetric ? prevMetric.newPane : newPane,
                                  newPane,
                                },
                              ]);
                            }}
                            defaultValue="newPane"
                          >
                            <ToggleGroupPrimitive.Item
                              className="px-2 py-1 font-medium radix-state-on:bg-[#CCDEEE] dark:radix-state-on:bg-[#46464F] radix-state-off:bg-white dark:radix-state-off:bg-[#2A2A31] whitespace-nowrap text-xs rounded text-[#808495] dark:text-white"
                              value="newPane"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              New pane
                            </ToggleGroupPrimitive.Item>
                          </ToggleGroupPrimitive.Root>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        ))}
      </TabsPrimitive.Content>
      {Object.keys(FINANCIAL_METRICS).map((key) => (
        <TabsPrimitive.Content
          value={key}
          key={key}
          className="radix-state-inactive:hidden flex flex-col h-[calc(100vh-400px)] overflow-y-auto"
        >
          {FINANCIAL_METRICS?.[key]?.children
            ?.filter((child) =>
              child.children?.some((grandChild) =>
                grandChild.label.toLowerCase().includes(filter.toLowerCase()),
              ),
            )
            .map((child) => (
              <div key={child.id}>
                <p className="px-2.5 py-2 text-[#808495] uppercase">{child.label}</p>
                {child?.children
                  ?.filter((grandChild) =>
                    grandChild.label.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((grandChild) => (
                    <div
                      onClick={() => {
                        if (
                          selectedMetrics?.find((item) => item.id === grandChild.id)
                        ) {
                          setSelectedMetrics(
                            selectedMetrics?.map((item) => {
                              if (item.id === grandChild.id) {
                                return {
                                  ...item,
                                  active: !item.active,
                                  newPane:
                                    item.newPane === undefined
                                      ? "newPane"
                                      : item.newPane,
                                  prevPane: item.newPane,
                                };
                              }
                              return item;
                            }),
                          );
                        } else {
                          setSelectedMetrics([
                            ...selectedMetrics,
                            {
                              ...grandChild,
                              label: key,
                              color: getSecurityColor(),
                              active: true,
                              newPane: "newPane",
                              prevPane: "newPane",
                            },
                          ]);
                        }
                      }}
                      className="group px-2.5 py-2 rounded flex items-center justify-between w-full dark:hover:bg-[#24242A] hover:bg-[#f0f3fa] cursor-pointer"
                      key={grandChild.id}
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-bold">{grandChild.label}</span>
                        <span className="text-light-500 dark:text-light-300">
                          {grandChild.description}
                        </span>
                      </span>
                      <div className="flex gap-3 items-center">
                        <ToggleGroupPrimitive.Root
                          type="single"
                          value={
                            selectedMetrics?.find((item) => item.id === grandChild.id)
                              ?.period || "annual"
                          }
                          onValueChange={(value) =>
                            value &&
                            setSelectedMetrics([
                              ...(selectedMetrics?.filter(
                                (item) => item.id !== grandChild.id,
                              ) || []),
                              {
                                ...(selectedMetrics?.find(
                                  (item) => item.id === grandChild.id,
                                ) || {
                                  ...grandChild,
                                  label: key,
                                  color: getSecurityColor(),
                                }),
                                active: true,
                                period: value,
                              },
                            ])
                          }
                          defaultValue="annual"
                          className="gap-1 hidden group-hover:flex"
                        >
                          {["annual", "quarterly"].map((value) => (
                            <ToggleGroupPrimitive.Item
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              key={value}
                              value={value.replace("ly", "")}
                              className="px-2 py-1 capitalize font-medium radix-state-on:bg-[#CCDEEE] dark:radix-state-on:bg-[#46464F] radix-state-off:bg-white dark:radix-state-off:bg-[#2A2A31] whitespace-nowrap text-xs rounded text-[#808495] dark:text-white"
                            >
                              {value}
                            </ToggleGroupPrimitive.Item>
                          ))}
                        </ToggleGroupPrimitive.Root>
                        <ToggleGroupPrimitive.Root
                          type="single"
                          className="hidden group-hover:flex ml-2"
                          value={
                            selectedMetrics?.find((item) => item.id === grandChild.id)
                              ?.newPane || "newPane"
                          }
                          onValueChange={(value) => {
                            const newPane = value === "newPane" ? "newPane" : "inChart";
                            const prevMetric = selectedMetrics?.find(
                              (item) => item.id === grandChild.id,
                            );
                            setSelectedMetrics([
                              ...(selectedMetrics?.filter(
                                (item) => item.id !== grandChild.id,
                              ) || []),
                              {
                                ...(prevMetric || {
                                  ...grandChild,
                                  label: key,
                                  color: getSecurityColor(),
                                }),
                                active: true,
                                prevPane: prevMetric ? prevMetric.newPane : newPane,
                                newPane,
                              },
                            ]);
                          }}
                          defaultValue="newPane"
                        >
                          <ToggleGroupPrimitive.Item
                            className="px-2 py-1 font-medium radix-state-on:bg-[#CCDEEE] dark:radix-state-on:bg-[#46464F] radix-state-off:bg-white dark:radix-state-off:bg-[#2A2A31] whitespace-nowrap text-xs rounded text-[#808495] dark:text-white"
                            value="newPane"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            New pane
                          </ToggleGroupPrimitive.Item>
                        </ToggleGroupPrimitive.Root>

                        <span className="w-6">
                          {selectedMetrics?.find((item) => item.id === grandChild.id)
                            ?.active ? (
                            <CheckIcon className="w-4 text-light-500 dark:text-light-300" />
                          ) : null}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
