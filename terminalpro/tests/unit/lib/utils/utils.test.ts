import { describe, expect, it } from "vitest";
import {
  beautifySlug,
  capitalize,
  ensureArray,
  ensureString,
  extractUrlsFromText,
  formatFileSize,
  formatNumber,
  formatNumberMagnitude,
  formatNumberNoMagnitude,
  formatNumberThousands,
  getContrastColor,
  hexToRGBString,
  isLight,
  isTabPath,
  isUUID,
  isValidUrl,
  parseValue,
  shuffle,
  slugify,
  slugifyWithExtension,
  toFixedString,
} from "~/lib/utils/utils";

describe("slugifyWithExtension", () => {
  it("should slugify filenames with unicode characters", () => {
    expect(slugifyWithExtension("Библиография для диссертации.md")).toBe(
      "библиография_для_диссертации.md",
    );
    expect(slugifyWithExtension("文件名.txt")).toBe("文件名.txt");
    expect(slugifyWithExtension("नाम नाम.csv")).toBe("नाम_नाम.csv");
    expect(slugifyWithExtension("Nom du fichier.docx")).toBe("nom_du_fichier.docx");
    expect(slugifyWithExtension("Nombre del archivo.pdf")).toBe(
      "nombre_del_archivo.pdf",
    );
  });

  it("should handle filenames without extensions", () => {
    expect(slugifyWithExtension("Библиография для диссертации")).toBe(
      "библиография_для_диссертации",
    );
    expect(slugifyWithExtension("文件名")).toBe("文件名");
  });

  it("should handle empty strings", () => {
    expect(slugifyWithExtension("")).toBe("");
  });

  it("should handle special characters and spaces", () => {
    expect(slugifyWithExtension("My File (1).txt")).toBe("my_file_1.txt");
    expect(slugifyWithExtension("Report #1 - Final.pdf")).toBe("report_1_-_final.pdf");
    expect(slugifyWithExtension("Data Analysis & Results.xlsx")).toBe(
      "data_analysis_results.xlsx",
    );
  });

  it("should preserve hyphens and underscores", () => {
    expect(slugifyWithExtension("my-file_name.txt")).toBe("my-file_name.txt");
    expect(slugifyWithExtension("test-file_name (1).md")).toBe("test-file_name_1.md");
  });

  it("should handle filenames with multiple periods", () => {
    expect(slugifyWithExtension("my.cool.file.xlsx")).toBe("my.cool.file.xlsx");
    expect(slugifyWithExtension("data.analysis.2023.csv")).toBe(
      "data.analysis.2023.csv",
    );
    expect(slugifyWithExtension("file...with.multiple.dots.txt")).toBe(
      "file.with.multiple.dots.txt",
    );
  });

  it("should handle special characters correctly", () => {
    expect(slugifyWithExtension("file#1.docx")).toBe("file_1.docx");
    expect(slugifyWithExtension("report&data.pdf")).toBe("report_data.pdf");
    expect(slugifyWithExtension("test@file.txt")).toBe("test_file.txt");
    expect(slugifyWithExtension("document!.pdf")).toBe("document.pdf");
    expect(slugifyWithExtension("data+info.xlsx")).toBe("data_info.xlsx");
  });

  it("should handle edge cases", () => {
    expect(slugifyWithExtension("filename")).toBe("filename");
    expect(slugifyWithExtension(".gitignore")).toBe(".gitignore");
    expect(slugifyWithExtension("file___w_underscores.txt")).toBe(
      "file_w_underscores.txt",
    );
    expect(slugifyWithExtension("  spaced file  .txt")).toBe("spaced_file.txt");
    expect(slugifyWithExtension("MiXeDcAsE.txt")).toBe("mixedcase.txt");
  });

  it("should properly sanitize invalid characters in extensions", () => {
    expect(slugifyWithExtension("file.txt<")).toBe("file.txt");
    expect(slugifyWithExtension("file.tx<t")).toBe("file.txt");
    expect(slugifyWithExtension("file.<>")).toBe("file");
    expect(slugifyWithExtension("file.txt ")).toBe("file.txt");
    expect(slugifyWithExtension("file.txt<>&")).toBe("file.txt");
    expect(slugifyWithExtension("file.txt?*|")).toBe("file.txt");
    expect(slugifyWithExtension("my-file!.txt<")).toBe("my-file.txt");
  });
});

describe("extractUrlsFromText", () => {
  it("should extract valid HTTP URLs", () => {
    const text = "Check out https://example.com for more info";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual(["https://example.com"]);
  });

  it("should extract valid HTTPS URLs", () => {
    const text = "Visit https://www.google.com and https://github.com";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual(["https://www.google.com", "https://github.com"]);
  });

  it("should extract and normalize URLs without protocol", () => {
    const text = "Go to www.example.com or www.google.com";
    const urls = extractUrlsFromText(text);
    expect(urls.length).toBe(2);
    // linkify-it normalizes URLs by adding protocol
    expect(urls).toContain("http://www.example.com");
    expect(urls).toContain("http://www.google.com");
  });

  it("should NOT extract email addresses as URLs", () => {
    const text = "Contact me at user@example.com or admin@test.org";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([]);
  });

  it("should NOT extract email domains preceded by @", () => {
    const text = "Send it to @gmail.com or @yahoo.com";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([]);
  });

  it("should handle mixed URLs and emails", () => {
    const text = "Visit https://example.com or email user@example.com";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual(["https://example.com"]);
  });

  it("should NOT detect false positives in code with dot notation", () => {
    const codeText = `from snowflake.snowpark.functions import col, count_distinct

# Tables (use your own DB/SCHEMA if needed)
idx = session.table("SEC_DEMO.SEC_REPORT_IDX").alias("idx")
tar = session.table("SEC_DEMO.SEC_REPORT_MENTIONS_TARIFF").alias("tar")

# a: per FILED_DATE counts from idx
a = (
    idx.group_by(col("FILED_DATE"))
       .agg(
           count_distinct(col("CIK")).alias("NumberOfCompanies"),
           count_distinct(col("ADSH")).alias("NumberOfDocs"),
       )
)

# b: join tar -> idx USING (ADSH), then group by idx.FILED_DATE
# Count DISTINCT of CIK and ADSH from the idx side (matches your SQL)
b = (
    tar.join(idx, tar["ADSH"] == idx["ADSH"])
       .group_by(idx["FILED_DATE"])
       .agg(
           count_distinct(idx["CIK"]).alias("NoCWithTariff"),
           count_distinct(idx["ADSH"]).alias("NoDWithTariff"),
       )
       # make FILED_DATE unambiguous and named the same as in SQL
       .select(
           idx["FILED_DATE"].alias("FILED_DATE"),
           col("NoCWithTariff"),
           col("NoDWithTariff"),
       )
)

# Final SELECT: a JOIN b USING (FILED_DATE) and compute percentage
result = (
    a.join(b, a["FILED_DATE"] == b["FILED_DATE"])
     .with_column(
         "PercMentionsTariff",
         (col("NoCWithTariff") / col("NumberOfCompanies") * 100),
     )
     .select(
         a["FILED_DATE"].alias("FILED_DATE"),
         a["NumberOfCompanies"],
         a["NumberOfDocs"],
         b["NoCWithTariff"],
         b["NoDWithTariff"],
         col("PercMentionsTariff"),
     )
     .sort(a["FILED_DATE"])
)

result.collect()`;

    const urls = extractUrlsFromText(codeText);
    expect(urls).toEqual([]);
  });

  it("should NOT detect false positives in Python code with method chaining", () => {
    const text = "session.table.group_by.agg.select.sort";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([]);
  });

  it("should NOT detect false positives in JavaScript/TypeScript code", () => {
    const text = "object.property.method().chain.call()";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([]);
  });

  it("should handle multiple URLs in a single line", () => {
    const text = "Check https://example.com and https://google.com and http://test.org";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([
      "https://example.com",
      "https://google.com",
      "http://test.org",
    ]);
  });

  it("should handle empty strings", () => {
    const urls = extractUrlsFromText("");
    expect(urls).toEqual([]);
  });

  it("should handle text with no URLs", () => {
    const text = "This is just plain text with no URLs at all";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([]);
  });

  it("should extract FTP URLs", () => {
    const text = "Download from ftp://ftp.example.com/file.zip";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual(["ftp://ftp.example.com/file.zip"]);
  });

  it("should handle URLs with paths and query parameters", () => {
    const text = "Visit https://example.com/path/to/page?param1=value1&param2=value2";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual([
      "https://example.com/path/to/page?param1=value1&param2=value2",
    ]);
  });
});

describe("isTabPath", () => {
  it("should return true for valid app paths with UUID", () => {
    expect(isTabPath("/app/550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("should return false for non-app paths", () => {
    expect(isTabPath("/login")).toBe(false);
    expect(isTabPath("/settings")).toBe(false);
  });

  it("should return false for app paths without UUID", () => {
    expect(isTabPath("/app/widgets")).toBe(false);
    expect(isTabPath("/app/settings")).toBe(false);
  });
});

describe("isUUID", () => {
  it("should return true for valid UUIDs", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("should return false for invalid UUIDs", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isUUID("")).toBe(false);
  });
});

describe("isValidUrl", () => {
  it("should return true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
  });

  it("should return false for invalid URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("should return false for multiple URLs in text", () => {
    expect(isValidUrl("https://a.com https://b.com")).toBe(false);
  });
});

describe("capitalize", () => {
  it("should capitalize first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("world")).toBe("World");
  });

  it("should handle empty strings", () => {
    expect(capitalize("")).toBe("");
  });

  it("should handle already capitalized strings", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  it("should handle single character", () => {
    expect(capitalize("a")).toBe("A");
  });
});

describe("slugify", () => {
  it("should convert to lowercase and replace spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Test String Here")).toBe("test-string-here");
  });

  it("should remove special characters", () => {
    expect(slugify("Hello! World?")).toBe("hello-world");
    expect(slugify("Test@#$String")).toBe("teststring");
  });

  it("should use custom separator", () => {
    expect(slugify("Hello World", "_")).toBe("hello_world");
  });

  it("should handle empty strings", () => {
    expect(slugify("")).toBe("");
  });
});

describe("beautifySlug", () => {
  it("should convert underscores to spaces and capitalize first word", () => {
    // beautifySlug capitalizes the first letter of each camelCase segment
    expect(beautifySlug("hello_world")).toBe(" Hello world");
  });

  it("should split camelCase", () => {
    expect(beautifySlug("helloWorld")).toBe(" Hello World");
  });

  it("should handle empty strings", () => {
    expect(beautifySlug("")).toBe("");
  });

  it("should handle null/undefined", () => {
    expect(beautifySlug(null as any)).toBe("");
    expect(beautifySlug(undefined as any)).toBe("");
  });

  it("should respect toUpperCase parameter", () => {
    expect(beautifySlug("hello_world", false)).toBe(" hello world");
  });
});

describe("shuffle", () => {
  it("should return array of same length", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  it("should contain same elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it("should not modify original array", () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });

  it("should handle empty arrays", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("should handle single element arrays", () => {
    expect(shuffle([1])).toEqual([1]);
  });
});

describe("formatNumber", () => {
  it("should format large numbers with magnitude suffix", () => {
    expect(formatNumber(1_500_000)).toContain("M");
    expect(formatNumber(2_500_000_000)).toContain("B");
  });

  it("should format thousands with commas", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(12345)).toBe("12,345");
  });

  it("should handle zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("should handle NaN", () => {
    expect(formatNumber(Number.NaN)).toBe("N/A");
  });

  it("should handle decimals", () => {
    expect(formatNumber(123.456)).toContain("123");
  });
});

describe("formatNumberThousands", () => {
  it("should add commas to large numbers", () => {
    // formatNumberThousands only adds commas when value > 1000 (not >= 1000)
    expect(formatNumberThousands(1001)).toBe("1,001");
    expect(formatNumberThousands(10000)).toBe("10,000");
    expect(formatNumberThousands(1000000)).toBe("1,000,000");
  });

  it("should not add commas to exactly 1000", () => {
    // The function uses > 1000, not >= 1000
    expect(formatNumberThousands(1000)).toBe("1000");
  });

  it("should handle string input", () => {
    expect(formatNumberThousands("10000")).toBe("10,000");
  });

  it("should handle small numbers", () => {
    expect(formatNumberThousands(100)).toBe("100");
  });
});

describe("formatNumberMagnitude", () => {
  it("should format millions", () => {
    expect(formatNumberMagnitude(1_500_000)).toContain("M");
  });

  it("should format billions", () => {
    expect(formatNumberMagnitude(2_500_000_000)).toContain("B");
  });

  it("should handle zero", () => {
    expect(formatNumberMagnitude(0)).toBe("0");
  });

  it("should handle NaN", () => {
    expect(formatNumberMagnitude(Number.NaN)).toBe("N/A");
  });
});

describe("formatNumberNoMagnitude", () => {
  it("should parse magnitude suffixes", () => {
    expect(formatNumberNoMagnitude("1K")).toBe(1000);
    expect(formatNumberNoMagnitude("1M")).toBe(1_000_000);
    expect(formatNumberNoMagnitude("1B")).toBe(1_000_000_000);
  });

  it("should handle plain numbers", () => {
    expect(formatNumberNoMagnitude(1000)).toBe(1000);
    expect(formatNumberNoMagnitude("1000")).toBe(1000);
  });
});

describe("toFixedString", () => {
  it("should format decimals correctly", () => {
    expect(toFixedString(123.456, 2)).toContain("123");
  });

  it("should handle integers", () => {
    expect(toFixedString(123, 2)).toBe("123");
  });

  it("should handle small decimals", () => {
    expect(toFixedString(0.123, 2)).toContain("0.12");
  });
});

describe("parseValue", () => {
  it("should parse numeric strings", () => {
    expect(parseValue("123")).toBe(123);
    expect(parseValue("123.45")).toBe(123.45);
  });

  it("should parse currency strings", () => {
    expect(parseValue("$1,000")).toBe(1000);
    expect(parseValue("€1,000")).toBe(1000);
  });

  it("should parse percentage strings", () => {
    expect(parseValue("50%")).toBe(50);
  });

  it("should return non-numeric strings unchanged", () => {
    expect(parseValue("hello")).toBe("hello");
  });

  it("should return dates unchanged", () => {
    expect(parseValue("2024-01-15")).toBe("2024-01-15");
  });
});

describe("getContrastColor", () => {
  it("should return white for dark colors", () => {
    expect(getContrastColor("#000000")).toBe("#FFFFFF");
    expect(getContrastColor("#333333")).toBe("#FFFFFF");
  });

  it("should return black for light colors", () => {
    expect(getContrastColor("#FFFFFF")).toBe("#000000");
    expect(getContrastColor("#EEEEEE")).toBe("#000000");
  });

  it("should return black for invalid colors", () => {
    expect(getContrastColor("invalid")).toBe("#000000");
  });
});

describe("isLight", () => {
  it("should return true for light colors", () => {
    expect(isLight("#FFFFFF")).toBe(true);
    expect(isLight("#EEEEEE")).toBe(true);
  });

  it("should return false for dark colors", () => {
    expect(isLight("#000000")).toBe(false);
    expect(isLight("#333333")).toBe(false);
  });

  it("should return false for invalid colors", () => {
    expect(isLight("invalid")).toBe(false);
  });
});

describe("hexToRGBString", () => {
  it("should convert hex to rgb", () => {
    expect(hexToRGBString("#FFFFFF")).toBe("rgb(255, 255, 255)");
    expect(hexToRGBString("#000000")).toBe("rgb(0, 0, 0)");
  });

  it("should handle alpha values", () => {
    expect(hexToRGBString("#FFFFFF", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });
});

describe("formatFileSize", () => {
  it("should format bytes", () => {
    expect(formatFileSize(500)).toBe("500B");
  });

  it("should format kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1KB");
    expect(formatFileSize(2048)).toBe("2KB");
  });

  it("should format megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1MB");
  });

  it("should format gigabytes", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1GB");
  });

  it("should handle decimal places", () => {
    expect(formatFileSize(1536, 1)).toBe("1.5KB");
  });
});

describe("ensureArray", () => {
  it("should return array unchanged", () => {
    expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("should wrap single values in array", () => {
    expect(ensureArray(1)).toEqual([1]);
    expect(ensureArray("test")).toEqual(["test"]);
  });

  it("should split comma-separated strings", () => {
    expect(ensureArray("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("should return default for null/undefined", () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
    expect(ensureArray(null, ["default"])).toEqual(["default"]);
  });
});

describe("ensureString", () => {
  it("should join arrays with commas", () => {
    expect(ensureString(["a", "b", "c"])).toBe("a, b, c");
  });

  it("should return strings unchanged", () => {
    expect(ensureString("test")).toBe("test");
  });

  it("should convert numbers to strings", () => {
    expect(ensureString(123)).toBe("123");
  });

  it("should handle null/undefined", () => {
    expect(ensureString(null as any)).toBe("");
    expect(ensureString(undefined as any)).toBe("");
  });
});
