import Markdown from "markdown-to-jsx";
import type React from "react";
import { Children, Fragment } from "react";
import { slugify } from "~/lib/utils/utils";
import { Tag } from "../ds/atoms/Tag";
import Icon from "../Icon";

const mdOptions = {
  wrapper: Fragment,
  overrides: {
    h1: { component: H1 },
    h2: { component: H2 },
    h3: { component: H3 },
    h4: { component: H4 },
    ul: { component: UL },
    ol: { component: OL },
    Article: { component: Article },
    li: { component: LI },
    Icon: { component: Icon },
  },
};

type ChangelogProps = { chunks: ChangelogChunk[] };

export function Changelog(props: ChangelogProps) {
  const { chunks } = props;
  return (
    <div className="space-y-2.5">
      {chunks.map((chunk, i) => {
        if ("version" in chunk) {
          return <ChangelogVersion key={i} chunk={chunk} />;
        }
        return <Markdown key={i} options={mdOptions} children={chunk.content} />;
      })}
    </div>
  );
}

interface ChangelogVersionProps {
  chunk: ChangelogVersionChunk;
}

export function ChangelogVersion(props: ChangelogVersionProps) {
  const { chunk } = props;
  return (
    <div id={chunk.slug} className="space-y-2.5 pt-2.5">
      <H2 slug={chunk.slug}>{chunk.heading}</H2>
      {chunk.changes.map((change) => {
        return (
          <div
            key={change.heading}
            className="space-y-4 p-2.5 bg-light-100 dark:bg-dark-700 rounded"
          >
            <H3>{change.heading}</H3>
            <Markdown options={mdOptions} children={change.content} />
          </div>
        );
      })}
    </div>
  );
}

export function H1(props: { children: React.ReactNode }) {
  const { children } = props;
  return <h1 className="body-sm-bold">{children}</h1>;
}

export function H2(props: { children: React.ReactNode; slug?: string }) {
  const { children, slug } = props;
  return (
    <a
      href={`#${slug}`}
      className="group flex items-center gap-2 no-underline transition"
    >
      <h2 className="body-xl-bold">{children}</h2>
      <Icon
        id="link-03"
        className="opacity-0 group-hover:opacity-100 transition w-3 h-3"
      />
    </a>
  );
}

export function H3(props: { children: React.ReactNode }) {
  const { children } = props;
  const headingColor =
    tagColors[children.toString().replace("[PRO]", "").toLowerCase().trim()];
  return (
    <>
      <Tag color={headingColor}>
        {Children.map(children, (child) =>
          typeof child === "string" ? child.replace("[PRO]", "") : child,
        )}
      </Tag>
      {Children.toArray(children).some(
        (child) => typeof child === "string" && child.includes("[PRO]"),
      ) && <span className="ml-2 obb-tag font-normal">Enterprise</span>}
    </>
  );
}

export function H4(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <h4 className="body-xs-bold">
      {Children.map(children, (child, index) => (
        <Fragment key={index}>
          {typeof child === "string" ? (
            child.includes("[PRO]") ? (
              <span>
                {child.replace("[PRO]", "")}
                <span className="ml-2 obb-tag font-normal">Enterprise</span>
              </span>
            ) : (
              child
            )
          ) : (
            child
          )}
        </Fragment>
      ))}
    </h4>
  );
}

export function UL(props: { children: React.ReactNode }) {
  const { children } = props;
  return <ul className="space-y-1 list-disc ml-6">{children}</ul>;
}

export function OL(props: { children: React.ReactNode }) {
  const { children } = props;
  return <ol className="space-y-1 list-decimal ml-6">{children}</ol>;
}

export function LI(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <li className="space-y-1">
      {Children.map(children, (child, index) => (
        <Fragment key={index}>
          {typeof child === "string" ? (
            child.includes("[PRO]") ? (
              <span>
                {child.replace("[PRO]", "")}
                <span className="ml-2 obb-tag">Enterprise</span>
              </span>
            ) : (
              child
            )
          ) : (
            child
          )}
        </Fragment>
      ))}
    </li>
  );
}

export function Article(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <>
      <article>{children}</article>
      <hr className="last:hidden" />
    </>
  );
}

/* Utils */

export interface ChangelogTextChunk {
  content: string;
}

export interface ChangelogVersionChunk {
  version: string;
  slug: string;
  /** Markdown formatted string of heading */
  heading: string;
  changes: ChangelogChanges[];
}

export type ChangelogChunk = ChangelogTextChunk | ChangelogVersionChunk;

const tagColors = {
  "new features": "brand",
  "bug fixes and improvements": "success",
  "breaking changes": "warning",
} as const;

export type ChangelogChangeType = keyof typeof tagColors;

export interface ChangelogChanges {
  type: ChangelogChangeType;
  /** Markdown formatted string of heading */
  heading: string;
  /** Markdown formatted string of content */
  content: string;
}

export function parseMarkdown(md: string) {
  const chunks: ChangelogChunk[] = [];

  const [head, ...changesets] = md.split(/^##\s/gm);
  chunks.push({ content: head });

  changesets.forEach((md) => {
    const [heading, ..._changes] = md.split(/^###\s/gm);
    const version = heading.replace(/\n/g, "").trim();
    const slug = slugify(version);
    const changes = _changes.map((change) => {
      const [heading, ...content] = change.split(/\n/g);
      return {
        type: heading.toLowerCase().trim() as ChangelogChangeType,
        heading,
        content: content.join("\n"),
      } as ChangelogChanges;
    });
    chunks.push({ version, slug, heading, changes });
  });

  return chunks;
}
