import {
  FontBoldIcon,
  FontItalicIcon,
  Link2Icon,
  ListBulletIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  UnderlineIcon,
} from "@radix-ui/react-icons";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { forwardRef, useCallback, useEffect, useMemo } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { z } from "zod";
import DraggableCard from "~/components/DraggableCard";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, getContrastColor, useEventListener } from "~/lib/utils";
import { MaterialSymbols123 } from "../../../Icons";
import useCopilotDataWidget from "../../Helpers/useCopilotDataWidget";
import { EditorExtensions, EditorOptions } from "./utils";

export const SettingsSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

export const MenuBar = forwardRef<
  HTMLDivElement,
  { editor: ReturnType<typeof useEditor> }
>(({ editor }, _) => {
  const updateWidget = useWidgetContext().updateWidget;
  const spellCheck = useWidgetContext().widget?.storage?.spellCheck ?? true;

  const editorState = useEditorState({
    editor,
    selector: ({ editor: editorInstance }) => {
      const canFocus = editorInstance.can().chain().focus;

      return {
        isItalic: editorInstance?.isActive("italic"),
        isUnderline: editorInstance?.isActive("underline"),
        isBulletList: editorInstance?.isActive("bulletList"),
        isOrderedList: editorInstance?.isActive("orderedList"),
        isAlignLeft: editorInstance?.isActive({ textAlign: "left" }),
        isAlignCenter: editorInstance?.isActive({ textAlign: "center" }),
        isAlignRight: editorInstance?.isActive({ textAlign: "right" }),
        isBold: editorInstance?.isActive("bold"),
        canToggleBold: canFocus().toggleBold().run(),
        canToggleItalic: canFocus().toggleItalic().run(),
        canToggleUnderline: canFocus().toggleUnderline().run(),
        canToggleBulletList: canFocus().toggleBulletList().run(),
        canToggleOrderedList: canFocus().toggleOrderedList().run(),
        canAlignLeft: canFocus().setTextAlign("left").run(),
        canAlignCenter: canFocus().setTextAlign("center").run(),
        canAlignRight: canFocus().setTextAlign("right").run(),
      };
    },
  });

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();

      return;
    }

    // update link
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const debouncedHandleColorChange = useDebounceCallback(
    (value: string) =>
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          color: value,
        },
      })),
    500,
  );

  if (!editor) return null;

  return (
    <div className="flex flex-row gap-3 absolute bottom-2.5 left-1/2 -translate-x-1/2 text-light-500 dark:text-light-400 z-10">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editorState?.canToggleBold}
        className={cn(editorState?.isBold ? "is-active" : "", "obb-icon-btn")}
      >
        <FontBoldIcon />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editorState?.canToggleItalic}
        className={cn(editorState?.isItalic ? "is-active" : "", "obb-icon-btn")}
      >
        <FontItalicIcon />
      </button>
      {/* spellcheck toggle */}
      <button
        onClick={() =>
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              spellCheck: !spellCheck,
            },
          }))
        }
        className={cn(spellCheck ? "is-active" : "", "obb-icon-btn")}
        title={`${spellCheck ? "Disable" : "Enable"} spellcheck`}
      >
        <Icon id="spell-check" />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editorState?.canToggleUnderline}
        className={cn(editorState?.isUnderline ? "is-active" : "", "obb-icon-btn")}
      >
        <UnderlineIcon />
      </button>
      <button onClick={setLink} className="obb-icon-btn">
        <Link2Icon />
      </button>
      {/*
      <button onClick={addImage} className="obb-icon-btn">
        <ImageIcon />
  </button>*/}
      <button
        className={cn(editorState?.isBulletList ? "is-active" : "", "obb-icon-btn")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={!editorState?.canToggleBulletList}
      >
        <ListBulletIcon />
      </button>
      <button
        className={cn(editorState?.isOrderedList ? "is-active" : "", "obb-icon-btn")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <MaterialSymbols123 className="-ml-0.5 w-5" />
      </button>
      <button
        className={cn(editorState?.isAlignLeft ? "is-active" : "", "obb-icon-btn")}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <TextAlignLeftIcon />
      </button>
      <button
        className={cn(editorState?.isAlignCenter ? "is-active" : "", "obb-icon-btn")}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <TextAlignCenterIcon />
      </button>
      <button
        className={cn(editorState?.isAlignRight ? "is-active" : "", "obb-icon-btn")}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <TextAlignRightIcon />
      </button>
      <div className="relative obb-icon-btn cursor-pointer">
        <input
          type="color"
          className="cursor-pointer"
          style={{
            opacity: 0,
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
          onChange={(event) => {
            const color = event.target.value;
            debouncedHandleColorChange(color);
          }}
        />
        <Icon id="color-picker-icon" />
      </div>
    </div>
  );
});

function MarkdownEditor() {
  const { widget, updateWidget, isShared } = useWidgetContext();
  const theme = useShallowThemeStore((state) => state.theme);

  const hideControls = widget?.storage?.hideControls || isShared;

  const color = useMemo(() => {
    const color = widget?.storage?.color;
    if (!color) return theme === "dark" ? "#fff" : "#000";
    const contrastColor = getContrastColor(color);
    return contrastColor;
  }, [widget?.storage?.color, theme]);

  const saveHTMLDebounced = useDebounceCallback((html: string) => {
    if (updateWidget) {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          html,
          lastEdited: new Date().toISOString(),
        },
      }));
    }
  }, 690); //* didier had the idea to make it 690ms instead of 500ms

  const editor = useEditor({
    content: widget?.storage?.html || widget?.data?.html || "",
    editorProps: EditorOptions,
    extensions: EditorExtensions,
    editable: !isShared,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html === widget?.storage?.html) return;
      if (saveHTMLDebounced.isPending()) saveHTMLDebounced.cancel();
      saveHTMLDebounced(html);
    },
    onDestroy: () => {
      saveHTMLDebounced.flush();
    },
  });

  useEffect(() => {
    return () => saveHTMLDebounced.flush();
  }, [saveHTMLDebounced]);

  useEventListener(`updateWidget-${widget?.id}`, (w) => {
    if (typeof w === "function") return;

    if (w?.storage?.html && editor) {
      const html = editor.getHTML();
      if (html === widget?.storage?.html) return;
      editor.commands.setContent(w.storage.html);
    }
  });

  useCopilotDataWidget({
    aiEnabled: true,
    title: widget?.name,
    aiData: widget?.storage?.html,
  });

  const onClick = useCallback(
    (e) => {
      const target = e.target as HTMLElement;
      if (target.id !== "markdown-editor-content") return;
      e.stopPropagation();
      editor?.chain().focus().run();
    },
    [editor?.chain],
  );

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: widget?.storage?.color,
      }}
      className="flex h-full w-full text-xs dark:bg-[#212126] prose dark:prose-invert max-w-none prose-headings:my-1.5 prose-p:my-1"
    >
      {!hideControls && <MenuBar editor={editor} />}
      <EditorContent
        key={`editor-content-${widget?.id}`}
        id="markdown-editor-content"
        style={{
          color,
        }}
        placeholder="Add your notes. Click here and start typing."
        spellCheck={widget?.storage?.spellCheck}
        className={cn(
          "widgetContent widget _note",
          "w-full overflow-y-scroll px-2 pt-0.5",
          "[&_.is-editor-empty:first-child::before]:text-light-500", // light mode placeholder
          "dark:[&_.is-editor-empty:first-child::before]:text-dark-100", // dark mode placeholder
          {
            "editor-dark": color === "#fff",
            editor: color === "#000",
          },
          {
            "h-[calc(100%-5px)]": hideControls,
            "h-[calc(100%-38px)]": !hideControls,
          },
        )}
        editor={editor}
      />
    </div>
  );
}

export default function MarkdownRoot() {
  const { updateWidget, isShared } = useWidgetContext();
  const { name, storage: { hideControls: hideControlsStorage } = {} } =
    useWidgetContext().widget;
  const hideControls = hideControlsStorage || isShared;

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={true}
      title={name}
      extraClassName="p-0!"
      extraNavbarElements={
        !isShared && (
          <Tooltip message="Hide/Show controls">
            <button
              className="obb-small-navbar-btn"
              onClick={() => {
                updateWidget((prev) => ({
                  ...prev,
                  storage: {
                    ...prev.storage,
                    hideControls: !prev?.storage?.hideControls,
                  },
                }));
              }}
            >
              <Icon id={`eye-${hideControls ? "closed" : "opened"}-icon`} />
            </button>
          </Tooltip>
        )
      }
    >
      <MarkdownEditor />
    </DraggableCard>
  );
}

/*const addImage = useCallback(() => {
    //const uploadMethod = window.prompt("Choose upload method: 'file' or 'url'");

    //if (uploadMethod === "file") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/jpg";

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files[0];
      if (file) {
        const reader = new FileReader();

        reader.onload = () => {
          const base64Data = (reader.result as string).split(",")[1]; // Extract base64 data from the result
          editor
            .chain()
            .focus()
            .setImage({ src: `data:image/png;base64, ${base64Data}` })
            .run();
        };

        reader.readAsDataURL(file); // Read the file as base64 data
      }
    };

    input.click();
  }, [editor]);*/
