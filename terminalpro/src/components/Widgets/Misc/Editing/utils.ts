import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import CodeBlock from "@tiptap/extension-code-block";
import Details from "@tiptap/extension-details";
import DetailsContent from "@tiptap/extension-details-content";
import DetailsSummary from "@tiptap/extension-details-summary";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Text from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import type { EditorProps } from "@tiptap/pm/view";
import type { Extensions } from "@tiptap/react";
import { round } from "lodash";
import { Markdown } from "tiptap-markdown";

export const EditorOptions = {
  handleDrop: (view, event, _slice, moved) => {
    if (!(!moved && event?.dataTransfer?.files?.[0])) return false; // not handled use default behaviour

    // if dropping external files
    const file = event.dataTransfer.files[0]; // the dropped file
    const filesize = round(file.size / 1024 / 1024, 4); // get the filesize in MB

    if (!(["image/jpeg", "image/png"].includes(file.type) && filesize < 10)) {
      window.alert(
        "Images need to be in jpg or png format and less than 10mb in size.",
      );
      return false; // not handled use default behaviour
    }

    // check valid image type under 10MB
    const reader = new FileReader();
    reader.onload = () => {
      const { clientX, clientY } = event;
      const coordinates = view.posAtCoords({ left: clientX, top: clientY });
      const node = view.state.schema.nodes.image.create({
        src: reader.result,
      }); // creates the image element
      const transaction = view.state.tr.insert(coordinates.pos, node); // places it in the correct position
      view.dispatch(transaction);
    };
    reader.readAsDataURL(file); // Read the file as base64 data

    return true; // handled
  },
  handleKeyDown: (view, event) => {
    if (event.key !== "Tab") return false;

    event.preventDefault();
    const { state, dispatch } = view;
    dispatch(state.tr.insertText("    ")); // Insert 4 spaces
    return true;
  },
} as EditorProps;

export const EditorExtensions = [
  Document,
  Heading,
  History,
  Paragraph,
  Placeholder.configure({
    includeChildren: true,
    placeholder: ({ node }) => {
      if (node.type.name === "detailsSummary") {
        return "Summary";
      }

      return "Add your notes. Click here and start typing.";
    },
  }),
  Details,
  DetailsSummary,
  DetailsContent,
  Text,
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  BulletList.configure({
    HTMLAttributes: {
      class: "list-disc pl-4",
    },
  }),
  OrderedList.configure({
    HTMLAttributes: {
      class: "list-decimal pl-6",
    },
  }),
  ListItem,
  Bold,
  Italic,
  Underline,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  Link.configure({
    HTMLAttributes: {
      class: "obb-hyper-link",
    },
    linkOnPaste: true,
  }),
  CodeBlock.configure({
    HTMLAttributes: {
      class: "obb-code",
    },
  }),
  Image,
  Markdown,
] as Extensions;
