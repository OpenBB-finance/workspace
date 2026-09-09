import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useDebounceValue } from "usehooks-ts";
import { useStateReducer } from "~/hooks/useStateReducer";
import TextStyle from "../AI/TextStyle";
import { Input } from "../ds/atoms/Input";
import Icon from "../Icon";
import useSharedPrompts from "../LayoutAuth/Search/hooks/useSharedPrompts";
import { TabContentHeader } from "../LayoutAuth/Skeleton/TabContentHeader";

export function SharedWithMeTab() {
  const [state, dispatch] = useStateReducer({
    filter: "",
  });
  const [debouncedFilter] = useDebounceValue(state.filter, 300);

  const { sharedPrompts, isLoading, error } = useSharedPrompts(true);

  if (isLoading) {
    return (
      <TabsPrimitive.Content
        value="shared-with-me"
        className="text-xs flex flex-col gap-4 p-6 h-full"
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-lighter" />
        </div>
      </TabsPrimitive.Content>
    );
  }

  if (error) {
    return (
      <TabsPrimitive.Content
        value="shared-with-me"
        className="text-xs flex flex-col gap-4 p-6 h-full"
      >
        <div className="flex items-center justify-center h-full text-red-500">
          Error loading shared resources
        </div>
      </TabsPrimitive.Content>
    );
  }

  const filteredPrompts = sharedPrompts.filter((prompt) =>
    prompt.prompt.toLowerCase().includes(debouncedFilter.toLowerCase()),
  );

  return (
    <TabsPrimitive.Content
      value="shared-with-me"
      className="text-xs flex flex-col gap-4 p-6 h-full"
    >
      <TabContentHeader.Root>
        <TabContentHeader.Left>
          <TabContentHeader.Title>
            Access prompts that have been shared with you by other users.
          </TabContentHeader.Title>
        </TabContentHeader.Left>
      </TabContentHeader.Root>

      <div className="p-1 pt-4">
        <Input
          size="sm"
          className="sm:w-[210px] h-full [&_input]:h-full"
          placeholder="Search for a prompt"
          prefix={<Icon id="search" />}
          value={state.filter}
          onChange={(value: string) => dispatch({ filter: value })}
          clearable={true}
        />
      </div>

      <div className="bg-white dark:bg-dark-900 p-4 rounded-sm overflow-y-auto">
        <div className="flex flex-col space-y-2">
          {filteredPrompts.length === 0 ? (
            <div className="flex items-center gap-2 p-2.5 text-ds-text-caption">
              No prompts have been shared with you yet
            </div>
          ) : (
            filteredPrompts.map((prompt) => (
              <TextStyle
                key={prompt.uuid}
                content={prompt.prompt}
                className="p-1 text-sm text-light-900 dark:text-light-100"
              />
            ))
          )}
        </div>
      </div>
    </TabsPrimitive.Content>
  );
}
