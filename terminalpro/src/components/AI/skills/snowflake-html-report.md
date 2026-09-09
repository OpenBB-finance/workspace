# Snowflake Native App -- Financial Report Generator

You are generating a **professional financial report** in HTML format with Snowflake Native App + OpenBB co-branding. The output must be a single self-contained HTML file that, when opened in a browser and printed to PDF, looks like a polished institutional-grade document.

The user will specify what kind of report they want (equity research, investment memo, credit analysis, etc.) and a subject. You must adapt the page structure, sections, and data to match the report type while keeping the Snowflake + OpenBB co-branding and visual system consistent.

---

## REPORT TYPES & SUGGESTED STRUCTURES

The template system supports any report type. Below are suggested page structures -- adapt as needed based on the user's request. **The page count is flexible** (1-page summary to 10+ page deep-dive).

### Equity Research
- **Page 1**: Two-column cover (narrative left / Key Financial Data + indexed chart right)
- **Page 2**: Financial tables (Income Statement, Valuation, Credit metrics)
- **Page 3**: Target Price & Ratings History chart + rating definitions

### Investment Memo
- **Page 1**: Two-column cover (thesis left / Key Deal Data right)
- **Page 2**: Market opportunity & competitive landscape narrative (full-width)
- **Page 3**: Financial projections tables + returns analysis
- **Page 4**: Risk matrix & mitigants

### Credit Analysis
- **Page 1**: Two-column cover (credit summary left / Key Credit Data right)
- **Page 2**: Financial tables focused on leverage, coverage, liquidity
- **Page 3**: Debt maturity profile chart + covenant analysis

### Industry Overview
- **Page 1**: Full-width narrative with key stats sidebar
- **Page 2**: Market sizing tables + growth projections
- **Page 3**: Competitive landscape comparison tables

### Due Diligence Report
- **Page 1**: Two-column cover (summary left / Key Metrics right)
- **Page 2+**: Detailed findings by category (full-width sections)

### Portfolio Review
- **Page 1**: Portfolio summary table + allocation chart
- **Page 2**: Performance attribution + individual holdings analysis

### Any Other Type
- Adapt page structure to content needs
- Use the component library below to assemble pages

---

## REPORT GENERATION WORKFLOW

### Step 1: Determine Report Type & Structure

From the user's request, identify:
1. **Report type** → sets the default page structure
2. **Subject** → company, deal, industry, portfolio, etc.
3. **Sections needed** → select from the component library below
4. **Data requirements** → what to gather

### Step 2: Gather Data

Use available tools (financial datasets MCP, web search, etc.) to collect data appropriate to the report type. If the user provides data or asks for mock data, use that instead.

### Step 3: Write Content

Adapt the writing style to the report type:
- **Equity Research**: Institutional analyst voice, "We expect", "We believe"
- **Investment Memo**: Deal-oriented, "The opportunity", "We recommend"
- **Credit Analysis**: Risk-focused, "The issuer", "Coverage ratios suggest"
- **Industry Overview**: Descriptive, trend-focused, data-heavy
- **Due Diligence**: Findings-based, "Our review indicates", "We note"
- **Portfolio Review**: Performance-oriented, attribution-focused

### Step 4: Build the HTML

Assemble pages using the CSS framework and component library below.

---

## PAGE COMPONENT LIBRARY

Mix and match these components to build any report type. Each component has its own CSS class and HTML structure.

### Cover Page Components
- `title-banner` -- Gradient Snowflake + Native App + OpenBB co-branded banner (WebP image)
- `cover-layout` -- Two-column layout (58% left / 38% right)
- `company-name` / `report-title` -- 18pt title
- `subtitle` -- 10pt tagline
- `analyst-block` -- Author attribution
- `section-header` -- Section divider with thin gray rule
- `body-text` with `.lead-in` -- Justified paragraphs with bold+underlined first sentence
- `kfd-table` -- Key data sidebar table (label/value pairs)
- `chart-container` -- SVG chart wrapper

### Financial Table Components
- `fin-table` -- Full-width data table with header row
- `fin-table .sub-row` -- Italicized indented sub-rows (e.g., % y/y)
- `fin-table .gap-row` -- Visual spacer between table sections
- `fin-source` -- Source attribution below tables

### Chart Components
- Indexed performance line chart (two-series, company vs benchmark)
- Target price & ratings history chart (dual-axis with step-line)
- **Any custom SVG chart** -- bar charts, area charts, waterfall charts, pie/donut charts, scatter plots

### Rating / Scoring Components
- `rating-box` -- Bordered box with rating definitions
- `tp-history-table` -- Blue-header companion table for chart data
- `tp-layout` -- Side-by-side chart + table layout

### Full-Width Narrative Components
- Use `body-text` class across full page width (remove `cover-layout` wrapper)
- Use multiple `section-header` dividers to organize content
- Tables can be interspersed with narrative paragraphs

---

## CRITICAL FORMATTING RULES

These rules apply to ALL report types and must be followed exactly.

### Font & Typography

- **Font family**: `Lato, 'Segoe UI', Arial, Helvetica, sans-serif` -- include Google Fonts import: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap">`
- **Lead-in sentences**: Must be both **bold AND underlined** (`font-weight: bold; text-decoration: underline;`)
- **Source attributions** below tables: Regular weight, NOT italic
- **SVG chart text**: Must also use the same sans-serif font family

### Writing Style

- **Justified text alignment** for all body paragraphs
- **Bold + underlined lead-in sentences**: Narrative paragraphs start with a bold+underlined first sentence ending with a period, then continue in regular weight
- Currency: Always "USD" prefix in body text (e.g., "USD210mn"), "$" is acceptable in tables
- Percentages: Use `%` symbol inline (e.g., "17% y/y")
- Year-over-year: Write as "y/y"
- Fiscal year: Format as "FY24", "FY2025F" -- "F" suffix for forecasts/estimates
- No bullet points in body text -- everything in paragraph form
- Tone: Professional, analytical, third-person

### Numbers in Tables

- Right-aligned
- Comma-separated thousands (e.g., "394,328")
- Negative values in parentheses: `(2.8)`, `(10.6)`
- y/y percentage sub-rows: italicized, indented
- Missing data: show as "-"
- Not meaningful: show as "nm"

### Every Page Must Have

1. **Top-right**: Report type text on left, "Snowflake | OpenBB" text branding on right
2. **Bottom**: Snowflake Blue accent line (`#29B5E8`) + "Powered by Snowflake Native App" + OpenBB wordmark logo

### Snowflake + OpenBB Co-Branding (Non-Negotiable)

These elements are constant across ALL report types:
- **Banner**: Full-width gradient SVG banner (Snowflake Blue `#29B5E8` -> Mid Blue `#11567F` -> Black) with Snowflake logo (left), "Native App" text (center), OpenBB logo (right)
- **Header**: Report type text on the left, "Snowflake | OpenBB" text on the right
- **Footer**: Snowflake Blue top-border line + "Powered by Snowflake Native App" left + OpenBB wordmark right
- **Colors**: Snowflake Blue `#29B5E8` main accent, chart series use Snowflake secondary palette

---

## OUTPUT FORMAT

Produce a single HTML file named `{Subject}_{ReportType}_Snowflake_Report.html`. The file must:

1. Be completely self-contained (inline CSS, embedded SVG charts, no external dependencies except Google Fonts)
2. Use `@media print` CSS for proper PDF generation
3. Use `@page` rules for A4 sizing and margins
4. Render charts as inline SVG elements
5. Include page breaks at the correct locations

---

## COLOR REFERENCE

| Element | Color | Hex |
|---------|-------|-----|
| Body text | Black | #000000 |
| Page background | White | #FFFFFF |
| **Main accent** / footer line / table headers | Snowflake Blue | #29B5E8 |
| Banner gradient start | Snowflake Blue | #29B5E8 |
| Banner gradient mid | Mid Blue | #11567F |
| Banner gradient end | Midnight | #000000 |
| **Group 1** / Primary chart series | Star Blue | #71D3DC |
| **Group 2** / Secondary chart series | Valencia Orange | #FF9F36 |
| **Group 3** / Tertiary chart series | Purple Moon | #7D44CF |
| **Group 4** / Quaternary chart series | First Light | #D45B90 |
| **Group 5** / Quinary chart series | Windy City | #8A999E |
| Table rules | Light gray | #CCCCCC |
| Chart gridlines | Light gray | #E0E0E0 |
| Section header underlines | Light gray | #CCCCCC |

---

## COMPLETE CSS FRAMEWORK & HTML TEMPLATE

Below is the full self-contained HTML template with all CSS classes. Assemble pages by selecting the components you need. Replace all `{{PLACEHOLDER}}` values with actual data.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Snowflake Native App - {{SUBJECT}}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap">
<style>
  /* ============================================================
     SNOWFLAKE NATIVE APP REPORT CSS FRAMEWORK
     Self-contained, print-ready, all report types
     ============================================================ */

  @page {
    size: A4 portrait;
    margin: 15mm 15mm 25mm 20mm;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Lato, 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    line-height: 1.35;
    color: #000000;
    background: #FFFFFF;
  }

  /* --- Page Container --- */
  .page {
    width: 170mm;
    margin: 0 auto;
    position: relative;
    padding-bottom: 20mm;
  }

  /* --- Recurring: Top Header --- */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .page-header .header-text {
    font-size: 9pt;
    color: #000000;
    font-weight: normal;
  }
  .page-header .header-brand {
    font-size: 9pt;
    color: #29B5E8;
    font-weight: bold;
    letter-spacing: 0.3px;
  }

  /* --- Recurring: Bottom Footer --- */
  .page-footer {
    font-size: 7pt;
    color: #666666;
    line-height: 1.3;
    border-top: 1.5px solid #29B5E8;
    padding-top: 4px;
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .page-footer .footer-logo svg {
    width: 50px;
    height: auto;
  }

  /* ============================================================
     BANNER (Gradient WebP -- Snowflake + Native App + OpenBB)
     ============================================================ */

  .title-banner {
    width: 100%;
    margin-bottom: 4px;
  }
  .title-banner img {
    width: 100%;
    height: auto;
    display: block;
  }

  /* ============================================================
     COVER PAGE COMPONENTS
     ============================================================ */

  .report-date {
    text-align: right;
    font-size: 10pt;
    margin-bottom: 10px;
  }

  /* Two-column layout */
  .cover-layout {
    display: flex;
    gap: 20px;
  }
  .cover-left {
    flex: 0 0 58%;
    max-width: 58%;
  }
  .cover-right {
    flex: 0 0 38%;
    max-width: 38%;
  }

  /* Full-width layout (for pages without sidebar) */
  .full-width {
    width: 100%;
  }

  .company-name, .report-title {
    font-size: 18pt;
    font-weight: normal;
    margin-bottom: 4px;
  }

  .subtitle {
    font-size: 10pt;
    font-weight: normal;
    margin-bottom: 14px;
    color: #000000;
  }

  .analyst-block {
    font-size: 9pt;
    margin-bottom: 14px;
  }
  .analyst-block .label {
    color: #666666;
  }

  .section-header {
    font-size: 11pt;
    font-weight: normal;
    border-bottom: 1px solid #CCCCCC;
    padding-bottom: 2px;
    margin-top: 12px;
    margin-bottom: 8px;
  }

  .body-text {
    text-align: justify;
    font-size: 9.5pt;
    line-height: 1.35;
    margin-bottom: 6px;
  }

  .body-text .lead-in {
    font-weight: bold;
    text-decoration: underline;
  }

  /* ============================================================
     KEY DATA TABLE (Sidebar)
     ============================================================ */

  .kfd-title {
    font-size: 11pt;
    font-weight: normal;
    margin-bottom: 6px;
  }

  .kfd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .kfd-table td {
    padding: 2px 0;
    border-bottom: 0.5px solid #E0E0E0;
  }
  .kfd-table td:first-child { text-align: left; }
  .kfd-table td:last-child { text-align: right; font-weight: normal; }

  .kfd-source {
    font-size: 8pt;
    margin-top: 2px;
    margin-bottom: 10px;
  }
  .kfd-closing {
    font-size: 8pt;
    font-style: italic;
    margin-bottom: 2px;
  }

  /* ============================================================
     CHARTS
     ============================================================ */

  .chart-title {
    font-size: 9pt;
    font-weight: normal;
    margin-bottom: 4px;
  }
  .chart-source {
    font-size: 8pt;
    margin-top: 2px;
  }
  .chart-container svg {
    width: 100%;
    height: auto;
  }
  .chart-container svg text {
    font-family: Lato, 'Segoe UI', Arial, Helvetica, sans-serif;
  }

  /* ============================================================
     FINANCIAL TABLES (Full-width)
     ============================================================ */

  .fin-section-title {
    font-size: 10pt;
    font-weight: normal;
    margin-bottom: 4px;
    margin-top: 14px;
  }

  .fin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 4px;
  }
  .fin-table thead th {
    font-weight: bold;
    text-align: right;
    padding: 3px 6px;
    border-bottom: 1px solid #000000;
    font-size: 9pt;
  }
  .fin-table thead th:first-child { text-align: left; }
  .fin-table tbody td {
    text-align: right;
    padding: 2px 6px;
    border-bottom: 0.5px solid #E0E0E0;
  }
  .fin-table tbody td:first-child { text-align: left; }

  .fin-table .sub-row td:first-child {
    padding-left: 15px;
    font-style: italic;
  }
  .fin-table .sub-row td { font-style: italic; }
  .fin-table .gap-row td { border-bottom: none; padding: 4px 0; }

  /* Highlighted header row variant (Snowflake Blue background) */
  .fin-table.blue-header thead th {
    background-color: #29B5E8;
    color: #FFFFFF;
    border-bottom: none;
  }

  .fin-source {
    font-size: 8pt;
    margin-bottom: 10px;
  }

  /* ============================================================
     COMPARISON / MATRIX TABLES
     ============================================================ */

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 8px;
  }
  .comparison-table thead th {
    background-color: #29B5E8;
    color: #FFFFFF;
    padding: 4px 6px;
    text-align: center;
    font-weight: bold;
    font-size: 8pt;
  }
  .comparison-table thead th:first-child {
    text-align: left;
  }
  .comparison-table tbody td {
    padding: 3px 6px;
    text-align: center;
    border-bottom: 0.5px solid #E0E0E0;
    font-size: 8.5pt;
  }
  .comparison-table tbody td:first-child {
    text-align: left;
    font-weight: bold;
  }

  /* ============================================================
     RATINGS / SCORING COMPONENTS
     ============================================================ */

  .tp-section-title {
    font-size: 11pt;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 8px;
  }

  .tp-layout {
    display: flex;
    gap: 15px;
    margin-bottom: 10px;
  }
  .tp-chart { flex: 0 0 55%; }
  .tp-table-wrap { flex: 0 0 42%; }

  .tp-history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  .tp-history-table thead th {
    background-color: #29B5E8;
    color: #FFFFFF;
    padding: 3px 4px;
    text-align: center;
    font-weight: bold;
    font-size: 7.5pt;
  }
  .tp-history-table tbody td {
    padding: 3px 4px;
    text-align: center;
    border-bottom: 0.5px solid #E0E0E0;
    font-size: 8pt;
  }

  .tp-attribution {
    font-size: 8pt;
    margin-top: 6px;
    margin-bottom: 12px;
  }

  .rating-box {
    border: 1px solid #000000;
    padding: 8px 10px;
    font-size: 8.5pt;
    line-height: 1.4;
    margin-bottom: 10px;
  }
  .rating-box .rating-name {
    font-weight: bold;
    text-decoration: underline;
  }
  .rating-box .footnote {
    font-style: italic;
    margin-top: 4px;
  }

  /* ============================================================
     CALLOUT / HIGHLIGHT BOXES
     ============================================================ */

  .callout-box {
    border-left: 3px solid #29B5E8;
    background: #FAFAFA;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 9pt;
  }
  .callout-box .callout-title {
    font-weight: bold;
    margin-bottom: 4px;
  }

  .highlight-box {
    border: 1px solid #71D3DC;
    background: #F0F9FB;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 9pt;
  }

  /* ============================================================
     METRIC CARDS (for KPIs / summary stats)
     ============================================================ */

  .metric-row {
    display: flex;
    gap: 12px;
    margin: 10px 0;
  }
  .metric-card {
    flex: 1;
    border: 1px solid #E0E0E0;
    padding: 8px 10px;
    text-align: center;
  }
  .metric-card .metric-value {
    font-size: 16pt;
    font-weight: bold;
    color: #000000;
  }
  .metric-card .metric-label {
    font-size: 7.5pt;
    color: #666666;
    margin-top: 2px;
  }

</style>
</head>
<body>

<!-- ============================================================
     PAGE 1: COVER PAGE
     ============================================================ -->
<div class="page" id="page1">

  <!-- HEADER (every page) -->
  <div class="page-header">
    <span class="header-text">{{REPORT_TYPE}}</span>
    <span class="header-brand">Snowflake | OpenBB</span>
  </div>

  <!-- BANNER (Snowflake + Native App + OpenBB gradient WebP) -->
  <div class="title-banner">
    <img src="https://openbb-cms.directus.app/assets/fc80e101-5aaf-492f-8ec2-e768a91478f9.webp" alt="Snowflake Native App powered by OpenBB" />
  </div>
  <div class="report-date">{{REPORT_DATE}}</div>

  <!-- TWO-COLUMN COVER (use this for reports with a data sidebar) -->
  <div class="cover-layout">
    <div class="cover-left">
      <div class="report-title">{{TITLE}}</div>
      <div class="subtitle">{{SUBTITLE}}</div>

      <div class="section-header">{{SECTION_1_HEADER}}</div>
      <p class="body-text">{{SECTION_1_BODY}}</p>

      <div class="section-header">{{SECTION_2_HEADER}}</div>
      <p class="body-text">
        <span class="lead-in">{{PARAGRAPH_1_LEAD_IN}}</span> {{PARAGRAPH_1_BODY}}
      </p>
      <p class="body-text">
        <span class="lead-in">{{PARAGRAPH_2_LEAD_IN}}</span> {{PARAGRAPH_2_BODY}}
      </p>
      <!-- Add more paragraphs as needed -->
    </div>

    <div class="cover-right">
      <div class="analyst-block">
        <div class="label">{{AUTHOR_LABEL}}</div>
        <div>{{AUTHOR_NAME_EMAIL}}</div>
      </div>

      <div class="kfd-title">{{SIDEBAR_TABLE_TITLE}}</div>
      <table class="kfd-table">
        <!-- Rows adapt to report type -->
        <tr><td>{{LABEL_1}}</td><td>{{VALUE_1}}</td></tr>
        <tr><td>{{LABEL_2}}</td><td>{{VALUE_2}}</td></tr>
        <!-- Add rows as needed -->
      </table>
      <div class="kfd-source">Source: Snowflake, OpenBB</div>

      <!-- Optional: chart in sidebar -->
      <div class="chart-title">{{CHART_TITLE}}</div>
      <div class="chart-container">
        {{CHART_SVG}}
      </div>
      <div class="chart-source">Source: Snowflake, OpenBB</div>
    </div>
  </div>

  <!-- FOOTER (every page) -->
  <div class="page-footer">
    <span>Powered by Snowflake Native App</span>
    <span class="footer-logo">
      <svg viewBox="0 0 170 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M106.107 1.889v11.334l-.961-.946-.959-.945-.962-.943-.959-.946-.961-.943-.962-.945-.959-.944-.961-.945-.96-.943-.961-.946-.96-.943-.96-.945H92.66V17H94.582V4.723l.96.943.96.945.961.944.96.945.961.943.959.946.962.943.961.945.959.946.962.943.959.945.961.944.96.945h.961V1.889H106.107ZM137.03 7.557h-1.921V1.889h-11.524V17h15.37V7.546h-1.92l-.005.01Zm-11.524-.946V3.773h7.683v3.78h-7.683V6.61Zm11.524 3.778v4.727h-11.524v-5.67h11.524v.943ZM168.901 7.557h-2.88V1.889h-11.526V0h-1.921v1.889h1.921V17h15.365V7.546l-.959.01Zm-12.485-.946V3.773h7.684v3.78h-7.684V6.61Zm11.526 3.778v4.727h-11.526v-5.67h11.526v.943ZM75.314 1.889H61.867V17H77.23V15.111H63.787V11.332h11.521V9.443H63.788V3.777H77.23V1.89h-1.916ZM13.444 1.889H0V17h15.367V1.889h-1.922Zm0 2.834V15.11H1.918V3.773h11.527v.95ZM44.397 1.889H30.952V17h1.92v-5.666h13.445V1.88h-1.92v.009Zm0 2.834V9.45H32.873V3.773h11.524v.95Z" fill="currentColor"/>
      </svg>
    </span>
  </div>
</div>


<!-- ============================================================
     PAGE 2+: ADDITIONAL PAGES
     Repeat the page/header/footer structure.
     Fill with any combination of components.
     ============================================================ -->
<div class="page page-break" id="page2">
  <div class="page-header">
    <span class="header-text">{{REPORT_TYPE}}</span>
    <span class="header-brand">Snowflake | OpenBB</span>
  </div>

  <!-- PAGE CONTENT: Use any combination of components -->
  {{PAGE_2_CONTENT}}

  <div class="page-footer">
    <span>Powered by Snowflake Native App</span>
    <span class="footer-logo">
      <svg viewBox="0 0 170 17" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M106.107 1.889v11.334l-.961-.946-.959-.945-.962-.943-.959-.946-.961-.943-.962-.945-.959-.944-.961-.945-.96-.943-.961-.946-.96-.943-.96-.945H92.66V17H94.582V4.723l.96.943.96.945.961.944.96.945.961.943.959.946.962.943.961.945.959.946.962.943.959.945.961.944.96.945h.961V1.889H106.107ZM137.03 7.557h-1.921V1.889h-11.524V17h15.37V7.546h-1.92l-.005.01Zm-11.524-.946V3.773h7.683v3.78h-7.683V6.61Zm11.524 3.778v4.727h-11.524v-5.67h11.524v.943ZM168.901 7.557h-2.88V1.889h-11.526V0h-1.921v1.889h1.921V17h15.365V7.546l-.959.01Zm-12.485-.946V3.773h7.684v3.78h-7.684V6.61Zm11.526 3.778v4.727h-11.526v-5.67h11.526v.943ZM75.314 1.889H61.867V17H77.23V15.111H63.787V11.332h11.521V9.443H63.788V3.777H77.23V1.89h-1.916ZM13.444 1.889H0V17h15.367V1.889h-1.922Zm0 2.834V15.11H1.918V3.773h11.527v.95ZM44.397 1.889H30.952V17h1.92v-5.666h13.445V1.88h-1.92v.009Zm0 2.834V9.45H32.873V3.773h11.524v.95Z" fill="currentColor"/>
      </svg>
    </span>
  </div>
</div>

</body>
</html>
```
