import { describe, expect, it } from "vitest";
import { protectAiMarkers } from "~/lib/utils/citationMarkers";

describe("protectAiMarkers", () => {
  it("round-trips AI citation markers into citation tags", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "Revenue grew. <|start_citation_id|>cite-1<|end_citation_id|>",
    );

    expect(protectedText).not.toContain("<|start_citation_id|>");
    expect(restoreAiMarkers(protectedText)).toBe(
      'Revenue grew. <citation className="cite-1"/>',
    );
  });

  it("round-trips AI artifact markers into artifact tags", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "See table <|start_artifact_id|>table_artifact_6725b<|end_artifact_id|>",
    );

    expect(protectedText).not.toContain("<|start_artifact_id|>");
    expect(restoreAiMarkers(protectedText)).toBe(
      'See table <artifact className="table_artifact_6725b"/>',
    );
  });

  it("trims whitespace around marker ids", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "<|start_citation_id|> cite-1 <|end_citation_id|>",
    );

    expect(restoreAiMarkers(protectedText)).toBe('<citation className="cite-1"/>');
  });

  it("handles citation and artifact tags that already carry a className", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "<citation className=\"cite-1\"/> and <artifact className='art-1'></artifact>",
    );

    expect(protectedText).not.toContain("<citation");
    expect(protectedText).not.toContain("<artifact");
    expect(restoreAiMarkers(protectedText)).toBe(
      '<citation className="cite-1"/> and <artifact className="art-1"/>',
    );
  });

  it("handles legacy citation and artifact tags with the id as content", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "<citation>cite-1</citation> <artifact>art-1</artifact>",
    );

    expect(restoreAiMarkers(protectedText)).toBe(
      '<citation className="cite-1"/> <artifact className="art-1"/>',
    );
  });

  it("handles the legacy colon citation form", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "Growth was strong <citation:cite-1>",
    );

    expect(restoreAiMarkers(protectedText)).toBe(
      'Growth was strong <citation className="cite-1"/>',
    );
  });

  it("drops markers whose id contains unsafe characters", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      'before <|start_citation_id|>"><img src=x onerror=alert(1)><|end_citation_id|> after',
    );

    const restored = restoreAiMarkers(protectedText);
    expect(restored).toBe("before  after");
    expect(restored).not.toContain("<img");
  });

  it("drops markers with an empty id", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "before <|start_citation_id|> <|end_citation_id|> after",
    );

    expect(restoreAiMarkers(protectedText)).toBe("before  after");
  });

  it("restores multiple markers of mixed types in order", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "<|start_citation_id|>c1<|end_citation_id|> mid <|start_artifact_id|>a1<|end_artifact_id|> end <citation>c2</citation>",
    );

    expect(restoreAiMarkers(protectedText)).toBe(
      '<citation className="c1"/> mid <artifact className="a1"/> end <citation className="c2"/>',
    );
  });

  it("leaves text without markers untouched", () => {
    const text = "Plain **markdown** with <b>html</b> and under_scores";
    const { protectedText, restoreAiMarkers } = protectAiMarkers(text);

    expect(protectedText).toBe(text);
    expect(restoreAiMarkers(protectedText)).toBe(text);
  });

  it("uses placeholders that survive an intermediate transform untouched", () => {
    const { protectedText, restoreAiMarkers } = protectAiMarkers(
      "x <|start_citation_id|>cite-1<|end_citation_id|> y",
    );

    // Simulate a sanitizer pass that strips tags but keeps plain text
    const transformed = protectedText.replace(/<[^>]*>/g, "");
    expect(restoreAiMarkers(transformed)).toBe('x <citation className="cite-1"/> y');
  });
});
