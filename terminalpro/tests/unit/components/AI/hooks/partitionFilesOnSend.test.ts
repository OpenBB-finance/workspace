import { describe, expect, it } from "vitest";
import { partitionFilesOnSend } from "~/components/AI/hooks/utils";
import type { CopilotFile } from "~/lib/state/copilot";

const file = (
  name: string,
  status: CopilotFile["status"],
  stored_file_uuid?: string,
): CopilotFile => ({
  name,
  description: `${name} description`,
  status,
  stored_file_uuid,
});

describe("partitionFilesOnSend", () => {
  it("sends uploaded files", () => {
    const uploaded = file("dailyreport.pdf", "uploaded", "uuid-1");

    expect(partitionFilesOnSend([uploaded])).toEqual({
      sent: [uploaded],
      hasPending: false,
    });
  });

  it("flags pending uploads so the send can be blocked", () => {
    const { sent, hasPending } = partitionFilesOnSend([
      file("uploading.pdf", "pending"),
    ]);

    expect(sent).toEqual([]);
    expect(hasPending).toBe(true);
  });

  it("keeps failed files out of the message", () => {
    const uploaded = file("dailyreport.pdf", "uploaded", "uuid-1");

    const { sent, hasPending } = partitionFilesOnSend([
      uploaded,
      file("broken.pdf", "failed"),
    ]);

    expect(sent).toEqual([uploaded]);
    expect(hasPending).toBe(false);
  });

  it("returns nothing for an empty composer", () => {
    expect(partitionFilesOnSend([])).toEqual({ sent: [], hasPending: false });
  });
});
