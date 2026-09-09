## Version 7.8.20 - August 25th, 2026

### Final Update

- #### OpenBB is shutting down and going open source

  More details here: <a href="https://openbb.co/blog/openbb-belongs-to-everyone" target="_blank"><u>https://openbb.co/blog/openbb-belongs-to-everyone</u></a>

## Version 7.0.0 - August 19th, 2026

### New Features

- #### Save a Conversation as a Skill

  While chatting with the copilot, say "save this as a skill" and the workflow you just went through is turned into a reusable skill in your skill library. The slug, name and description are generated for you from the conversation, and you can edit them before saving from the toast that appears while it is generating.

---

- #### Chat Search and Faster Chat Loading

  Chats now have a real search. Type a query and matching chats and messages come back from the server with highlighted snippets, so you can find an old conversation without scrolling through the sidebar. Opening a chat also loads its messages on demand instead of pulling every message for every chat up front. This will improve login times and provide an overall better user experience.

---

- #### Citations and Artifacts in Generated Notes

  Notes the copilot generates for you can now keep their citations and artifacts. Save an answer as a widget and the source chips and embedded charts or tables come along with it, instead of being flattened into plain text.

### Bug Fixes and Improvements

- #### Faster Initial Load

  The Workspace now downloads a lot less code before it will show you anything, we now have a roughly 16% smaller entry bundle. This should improve speed as well on initial load.

- #### Sign-In Redirects and Tab Parameters

  Fixed the welcome and redirect behavior after signing in so it no longer leaves duplicate entries in your browser history, meaning the back button behaves the way you would expect. Inner tab parameters are now resolved before navigating, which stops the URL from being rewritten with a redundant navigation when you switch tabs.

- #### Clearer Agent Errors When Building Dashboards

  When an agent or MCP client tries to act on a dashboard or widget that does not exist, the error now says what to do about it rather than just reporting the failure. Widget creation validates its inputs more strictly and rejects bad requests up front, and navigation bar operations return enough detail about the resulting tabs for the caller to keep working without a second lookup.

## Version 6.2.1 - August 3rd, 2026

### Bug Fixes and Improvements

- #### Microsoft Sign-In Reliability

  Fixed issues with Microsoft sign-in where sessions were not kept across browser tabs and users could be signed out incorrectly while the login system was still initializing.

- #### Table Cell Coloring

  Color rules on table cells are now applied consistently. Previously, cells could be miscolored or ignore their color rules when the underlying data mixed text and numbers.

- #### Bar Chart Fill Settings

  Fixed a bug where toggling the bar fill setting on one chart widget affected other bar charts on the same dashboard. Each widget now keeps its own fill setting.

- #### Token-Based MCP Server Connections

  MCP servers that require an access token no longer try to connect before a token has been entered, which previously produced a permanently failed connection in the AI tab. The server now stays off until you paste a token.

- #### Selectable Tools for Widget MCP Servers

  Tools from widget-based MCP servers were previously always active and could not be turned off. You can now select and deselect them individually in the tools dropdown.

- #### Connections Page Loading

  The Connections page now loads with the same smoother behavior as the Apps page.

- #### AI Chat References and Citations

  References to widgets or tabs that can't be resolved in the current context (for example, from another dashboard) now appear as a labeled chip with an explanation.

- #### Ticker Updates from AI

  Fixed a bug where asking the AI to change the ticker on a widget did not update the widget correctly.

- #### Sandbox App Renamed

  "OpenBB Sandbox" is now called "Sandbox App (FMP Data)" throughout the interface, to make clear where its data comes from.

## Version 6.2.0 - July 20th, 2026

### New Features

- #### Token Authentication for MCP Servers used in Apps

  Apps can now connect to MCP servers that use a static token instead of OAuth. When an app declares token authentication, you paste the token in its connection settings. See the <a href="https://docs.openbb.co/workspace/developers/json-specs/apps-json-reference#mcp-server-authentication" target="_blank"><u>documentation</u></a> for how to declare `authType` in your apps.json when creating an App.


### Bug Fixes and Improvements

- #### Raw Data View

  The raw data view in the HTML viewer and chart widgets now fetches current data every time you open it. Previously it could show results cached up to fifteen minutes earlier. See the <a href="https://docs.openbb.co/workspace/developers/widget-types/html#raw-data-view" target="_blank"><u>documentation</u></a> for how the raw data view works with HTML widgets.

- #### Microsoft Sessions Stay Signed In

  Signing in with Microsoft now renews your token in the background before it expires, so long-running sessions no longer go stale. If renewal genuinely requires signing in again, you are signed out cleanly instead of being left with a session that stopped working.

- #### Table Column Widths

  Auto-sized and manually adjusted column widths are now saved and restored when you switch a table widget to chart view and back. Previously the table re-fit its columns and threw sizing away.

- #### Backend Widget Settings Propagate to Placed Widgets

  Setting `enableAdvanced: false` in a custom backend's widgets.json now takes effect everywhere. Before, the setting was only read once when a widget was first added.

## Version 6.1.0 - July 10th, 2026

### Bug Fixes and Improvements

- #### Embedded Widgets Authentication

  Embedded (iframe) widgets now receive the widget's authentication headers through a new `openbb-auth` message when they connect. See the <a href="https://docs.openbb.co/workspace/developers/widget-types/iframe#receiving-auth-headers-openbb-auth" target="_blank"><u>documentation</u></a> for how to receive them in your iframe.

- #### Simplified Widget Search Filter

  The widget search filter is now a single choice between All Widgets, External, and Shared. "All Widgets" now includes shared widgets, and shared backends are grouped by their own categories.

- #### Workspace Copilot Reconnects After Visiting Admin

  Navigating to the admin area and back could leave the Workspace bridge stuck in a stale "connected" state. The bridge now re-establishes its connection when you return to the workspace.

- #### New `forceUpdate` Option for Group-By Columns

  Widget developers can set `forceUpdate: true` on a column's `groupBy` render function params in `widgets.json` so the grouped parameter is always applied when the cell is clicked. See the <a href="https://docs.openbb.co/workspace/developers/widget-parameters/cell-click-grouping#using-forceupdate-to-refresh-the-source-widget" target="_blank"><u>documentation</u></a> for details.

- #### MCP Servers Disconnect Cleanly

  If you close the OAuth sign-in popup for an MCP server without completing authentication (or the sign-in times out), the server is now disabled instead of re-opening the sign-in popup every time you reload the workspace.

## Version 6.0.0 - July 8th, 2026

### New Features

- #### Workspace MCP

  The Workspace MCP Companion is now fully hosted, so you no longer need to run it locally to use it. Connect AI tools like Claude Code, Codex, or Cursor directly to your Workspace through the hosted MCP endpoint, with built-in token management: create personal access tokens, copy them securely, and revoke them at any time. A status indicator shows your live connection state (connected, attempting, or reconnecting), and the bridge reconnects automatically if the connection drops. Check out the <a href="https://docs.openbb.co/agents/workspace-mcp-quickstart" target="_blank"><u>quickstart guide</u></a> to get connected.

### Bug Fixes and Improvements

- #### Smoother AI Chat Scrolling

  Fixed the AI chat forcefully snapping to the bottom while you were scrolling up to read earlier messages during a streaming response. The chat now only auto-scrolls when you're already at the bottom, and the "scroll to bottom" button no longer flickers when expanding citations.

- #### Shareable Links to Marketplace Apps

  Opening an app's details in the Apps marketplace now updates the page URL, so you can copy the link and share it directly. Navigating between apps with the previous/next arrows keeps the URL in sync, and reopening the same app after closing its details works reliably.

- #### Descriptive Browser Tab Titles

  Browser tabs now show where you are instead of always reading "OpenBB Workspace". You'll see the name of your active dashboard, plus pages like Apps, Settings, Connections, and the Admin Portal. White-labeled deployments show their own brand name.

- #### Creation Time on Notes and Artifacts

  Hover over the title of a markdown note or static artifact on your dashboard to see when it was created, or when it was last edited if editing is allowed.

- #### Admin Theme Settings Fixes

  Fixed layout and scrolling issues in the admin theme settings so the grouping color preview stays visible and scrolls properly, corrected preview colors in dark mode, and prevented grouping colors from being cleared to an empty value.

## Version 5.3.0 - June 29th, 2026

### New Features

- #### Generated Dashboard Apps

  When Generative UI is enabled, dashboard apps can be generated and opened by Copilot
  automatically.

---

### Bug Fixes and Improvements

- #### External Links Open In-App from Copilot

  External links in Copilot responses, citations, and markdown now open inside
  an in-app iframe instead of navigating away, keeping you in your workspace.

- #### Iframe Widget Parameter Improvements

  Reworked how iframe widgets handle their protocol and parameters, including
  more reliable parameter grouping and linked-parameter behavior.

- #### Raw Data Table for VegaLite + Highcharts

  The "raw data" table toggle is now available for VegaLite and Highcharts, matching the
  behavior already offered on Plotly charts so you can switch
  between the chart and its underlying data.

- #### Clickable Links in Widget Descriptions

  Widget descriptions can now have clickable external links.

- #### MCP Tool Suggestions for Iframe MCP

  Copilot chat now surfaces MCP tool suggestions when using an iframe MCP, added
  a tooltip clarifying Copilot agents.

- #### Consistent Table Formatting in AI Artifacts

  Tables generated by the AI assistant now inherit the same theme, number
  formatting (decimal digits), numeric alignment, and humanized column headers
  as dashboard widget tables.

- #### PDF Viewer

  Improved page-handling logic in the PDF viewer.

## Version 5.2.0 - June 12th, 2026

### New Features

- #### Suggested Prompts for Custom Agents

  The Copilot welcome screen now shows dashboard suggested prompts for any selected agent, not only the default OpenBB Copilot.

---

- #### HTML Widget Parameter Updates

  HTML widgets rendered in an iframe can now update other widget's parameters. This opens up many possibilities to create interactive dashboards in the Workspace. See the [OpenBB docs](https://github.com/OpenBB-finance/openbb-docs/pull/161) and [backend examples](https://github.com/OpenBB-finance/backends-for-openbb/pull/82) for examples on how to configure this.

### Bug Fixes and Improvements

- #### No More Duplicate Saved App Tabs

  Opening a saved app template now reuses an existing untouched dashboard when one is available instead of creating a duplicate tab. Modified dashboards are stamped with an updated timestamp.

- #### Roles and Permissions Admin Fixes

  Several fixes in the roles and permissions admin: permission rows now show the parent template name as a tag with a tooltip when the label is long, the access dropdowns are wider so the option text is no longer cut off, and the unused bulk role selection and multi-delete controls were removed from the roles page.

- #### MCP Tool Hover Details

  Hovering an MCP tool now shows its parsed input schema in the tooltip, so you can see what arguments the tool expects.

## Version 5.1.0 - June 8th, 2026

### New Features

- #### MCP Tool for Iframe Widgets

  Iframe widgets are now exposed through the Workspace MCP integration, letting our OpenBB Copilot or other external copilots interact with them. You can find the docs <a href="https://docs.openbb.co/workspace/developers/widget-types/iframe" target="_blank"><u>here</u></a> on how to setup this workflow. This integration will let you bring existing apps into the workspace without rebuilding them.

---

### Bug Fixes and Improvements

- #### Table Filters

  Active filters now appear as inline chips above the table, so you can see and clear them at a glance.

- #### Resizable Multi-File Viewer Sidebar

  The file list in the multi-file viewer can now be resized by dragging the divider between the file list and the PDF viewer. Your preferred size is remembered per widget.

- #### Redesigned Admin UI

  We redesigned the admin page to create a better experience for managing / editing users and groups.

- #### PDF Viewer Initial Page Render

  Fixed an issue where PDF widgets would show the wrong page number when switching between them.

- #### Copilot URL Underscores Preserved

  Copilot URLs containing underscores are no longer stripped or altered, so links to resources with underscores in their names now work correctly.

- #### Widget Metadata Handling

  Fixed missing and duplicated entries for chart and table widgets. These now appear under a "My Widgets" group and behave correctly when creating dashboards or deleting widgets.

- #### Omni Editor Code Generation Fix

  Code and text generation from prompts now works correctly for non-Snowflake omni editor widgets.

- #### General UI Improvements

  Various visual polish across the interface, including corrected colors and highlight states on the AI text input when typing slash commands.

## Version 5.0.1 - June 3rd, 2026
### Bug Fixes and Improvements

- #### Redesigned Marketplace Modals

  The App Marketplace modals have a new design to better showcase each app.

- #### Admin Portal Fixes

  Fixed several issues across the admin portal: the "select all backends" action, content overflow on the admin page, hidden groups still showing a group count, and parameter display on the visibility screen.

- #### Shared App Groups Preserved

  Shared templates no longer drop `groups` and other template fields when processed. Shared dashboards and apps now retain group state and widget syncing the same way private dashboards do.

- #### Chart Editing Fix

  Fixed a bug that prevented users from editing charts.

## Version 5.0.0 - May 27th, 2026

### New Features

- #### New State-of-the-Art Default Model

  We've upgraded the AI agent to a new state-of-the-art model to now be the default for both reasoning and vision tasks. It brings stronger analysis, better tool use, and improved understanding of charts and documents, with no setup required.

---

- #### Export Chats and Files

  You can now export your Copilot conversations and files directly from the Workspace, making it easier to save and share your work.

### Bug Fixes and Improvements

- #### MCP Companion Connection Fixes

  Fixed a bug where the Workspace/MCP connection wouldn't try to reconnect after it has been open for awhile.

- #### Admin Section Fixes

  Fixed several issues in the admin area, including the right-click menu incorrectly showing table options on the user and app pages, and prompt text overflowing in the prompt section and modal.

### Breaking Changes

- #### AI Workspace Options Sent as Keyed Objects

  The Workspace now sends AI `workspace_options` as an object keyed by option id (for example `{ "web-search": false, "model": "5.5" }`) instead of a list of strings. Agents and backends that read `workspace_options` must now expect an object rather than a list of enabled flags or `key=value` entries. Agents that only support the old list payload will need to be updated.

## Version 4.1.0 - May 21st, 2026

### New Features

- #### Workspace MCP

  The Workspace now exposes an MCP integration that lets Claude Code, Codex, and any MCP-compatible agent operate directly inside the Workspace — helping you build backend, reading the active session, managing widgets, and navigating pages and dashboards on your behalf. Run the local MCP server by following the setup in the <a href="https://github.com/OpenBB-finance/workspace-mcp" target="_blank"><u>workspace-mcp repo</u></a>, then connect your favorite local agent. Once connected you can find and enable the "MCP Companion" mode by clicking on the hamburger menu in the top left.

### Bug Fixes and Improvements

- #### "New" Tag on Recently Added Apps

  Apps created within the last 7 days now display a "New" tag on their card in the Apps list, making it easier to spot recently added content at a glance.

- #### Apps No Longer Create Duplicate Dashboards

  Opening the same App again no longer creates a new dashboard if the previously created one is still untouched — you'll be redirected to the existing dashboard instead. We've also updated the behavior to create a new (#) after a dash - mimicking the same behavior used by most OS's.

- #### DatePicker Shows the Correct Day in All Timezones

  Date-only values in the DatePicker no longer render or save as the previous day for users in positive-offset timezones. Saved widget parameters and displayed dates now use local date throughout.

- #### Hardened PDF External Links

  External links inside PDF widgets now open in a new tab, reducing the impact of phishing or unwanted navigation away from the app.

- #### General UI Improvements

  Various UI improvements, including RSS feed and markdown spacing adjustments, plus corrected color tokens and sizing on dialogs.

## Version 4.0.0 - May 11th, 2026

### New Features

- #### Workspace App Marketplace

  A curated set of apps from our data partners is now live inside the OpenBB Workspace. You can now browse, trial, and connect the data your team needs, without leaving the Workspace. We're onboarding new partners on a rolling basis and more apps will be released soon. Check out the <u>**[App Marketplace](/app?tab=apps-marketplace)**</u>.

- #### Vega Chart Widgets

  Initial support for Vega-powered chart widgets, including AI support, has been added to the Workspace. You can find the docs <a href="https://docs.openbb.co/workspace/developers/widget-types/vega-lite" target="_blank"><u>here</u></a> on how to add this widget type.

---

### New Snowflake Native App Features

- #### Snowflake Charts via Generative UI

  Generative UI can now create Snowflake-backed chart widgets directly, letting you turn Snowflake data into visualizations from natural language prompts.

---

- #### Support for SQL Parameters

  SQL-defined parameters can now created and grouped for the snowflake native app. This allows you to create and manage parameterss directly in your snowflake native without touching any backend code.

### Bug Fixes and Improvements

- #### Save App Preview & Copilot Chat Polish

  Refreshed the save app preview flow and improved the Copilot chat design.

- #### Faster API Source Validation

  External API source validation now runs in a dedicated web worker, so the UI no longer freezes while widgets, templates, headers, and URLs are validated.

- #### HTML Widget Support in Copilot

  Copilot can now correctly retrieve and use HTML widget content.

- #### Mobile Agent Fixes

  Several mobile-only fixes for the AI agent - widget search now renders correctly on mobile, mention/skill triggers (`@` and `SV`) work, voice input pulses, and an iOS textarea focus issue was resolved.

- #### Boolean Parameter Grouping

  Boolean parameters now group correctly alongside other parameter types.

- #### Advanced Charting Widget Grouping

  Group dropdowns now work for `advanced_charting` widgets with the group value from the widget's "symbol" param.

- #### Add Widget to Dashboard

  Fixed a citation/insertion issue where adding a widget to a dashboard would fail when its parameters changed.

## Version 3.6.0 - April 16th, 2026

### New Features

- #### DOCX and HTML File Support

  Upload and view DOCX and HTML files in Copilot and file widgets. DOCX files render through the document viewer, and HTML files display with full styling.

---

- #### Custom Agent Input Controls

  Agents can now define string and dropdown input fields, letting developers collect structured inputs from users before the agent runs.

### Bug Fixes and Improvements

- #### Consistent Branded Logo

  On-prem deployments with custom logos no longer flash the default logo during loading and placeholder states.

- #### MCP Skills Suggestion Fix

  Clicking a skill type in the suggestions menu now correctly inserts the skill command.

- #### Improved Slash Command Suggestions

  Skill and external tool suggestions in the chat input now share a single flow. Keyboard and mouse navigation work consistently, and selecting a suggestion inserts the command with correct spacing and cursor placement.

- #### General UI Improvements

  Spacing fixes in widget headers, better visibility for unavailable widget states, and a few other UI improvements on the OpenBB Sandbox App.


---

## Version 3.5.0 - March 19th, 2026

### New Features

- #### Skills

  You can now create, manage, and invoke custom AI skills directly from the chat interface. Skills are reusable instruction sets that can be triggered using a simple command syntax, allowing you to build personalized AI workflows. Check the <u>**[skills tab](/app/ai?tab=skills)**</u> under AI to get started and see our example skill. You can access skills by doing "/skill:{skillname}" in the chat interface.

---

- #### Parameter Validation Warning

  When connecting a backend with incorrect parameter key values, you now see a warning notification alerting you to the misconfiguration, making it easier to troubleshoot connection issues.

---

- #### MCP Tool Error Handling

  We now properly handle and display errors from MCP (Model Context Protocol) tools. When an external tool encounters an error, you will see a clear error message instead of a silent failure.

---

- #### Mobile Experience & Search Dialog

  Improved the mobile experience along with a completely new search dialog. Navigating and searching for widgets, dashboards, and content on mobile devices is now much smoother and more intuitive.

---

- #### Styled HTML Reports

  AI-generated reports now preserve their CSS styling when rendered as HTML. Reports created by OpenBB Copilot will appear with proper formatting.

### Bug Fixes and Improvements


- #### Navbar Auto-Lock for Active Widgets

  The navigation bar now automatically stays visible when certain widgets controls are active, such as chart view or the Copilot panel. This prevents the navbar from hiding while you are actively working with these tools.

- #### Transposed Widget Fix

  Fixed an issue where external widgets with transposed tables failed to display chart data correctly. We now properly detects custom column names in transposed layouts.

- #### Empty Copilot State Fixes

  Fixed display issues with the AI Copilot panel when no conversation or data is present.

- #### Custom App Navigation Fix

  Fixed an issue where widgets could disappear in custom apps when a custom navigation tab was present. Also fixed parameter groups controlled by table cell clicks from being incorrectly overwritten.

- #### Security Fix for Widgets

  Critical security fix that prevents potential cross-site scripting (XSS) attacks through iframe and HTML widgets.

## Version 3.4.0 - February 17th, 2026

### New Features

- #### Generative UI (Out of Beta)

  Generative UI has been promoted from Beta to a full release. All Beta tags have been removed — GenUI is now a standard part of the workspace.

---

- #### Table Formulas

  You can now add custom formula columns to your tables for dynamic calculations directly within the grid. Enable formulas from the table settings panel to try it out.

### Bug Fixes and Improvements

- #### Redesigned Sidebar Navigation

  The left sidebar has been reorganized for clearer navigation. A new **Connections** tab gives you a unified view of all your backend connections, showing quick metrics like apps, widgets, prompts, and agents count per connection. Under the **Library** section, the new **AI** tab consolidates all AI-related features in one place — including AI Agents, Prompts, and MCP Servers — each accessible via sub-tabs. The **Widgets** tab now lives alongside AI under Library for easier discovery.

- #### Naviatagor / Mini Chart Navigator

  Added a toggle in "Quick Actions" settings to have a Navigator bar shown under any AgGrid charts. Or you can set a mini chart navigator to be shown.

- #### PDF Export

  Fixed issues where PDF exports could fail due to cache problems.

- #### External Widget Chart State

  Fixed an issue where chart state in external widgets would not update correctly when column selections were changed.

- #### Fixed bug with Charting

  Some charts would not render correctly if the data wasn't aligned - that is fixed now.

## Version 3.3.2 - February 13th, 2026

### Bug Fixes and Improvements

- #### Fix PDF export with images

  Images were not exporting correctly - that is fixed with this patch.

## Version 3.3.1 - January 29th, 2026

### Bug Fixes and Improvements

- #### Parameter Change

  Fixed an issue where OpenBB Copilot would change a parameter in a widget and a new call wasn't being made.

- #### PDF Reading

  Fixed an issue where OpenBB Copilot couldn't read PDF files.

- #### UI Updates

  Changed a few color schemes in the UI to better match our current themes.

## Version 3.3.0 - January 19th, 2026

### New Features

- #### OKTA Login Support

  Added support for OKTA login for enterprise customers, enabling SSO integration.

---

- #### YouTube Widget

  Added a new YouTube widget to embed videos directly in your workspace. See the [docs](https://docs.openbb.co/workspace/developers/widget-types/youtube) for details.

---

- #### HTML Artifacts from Custom Copilots

  Added ability to support HTML artifacts from custom copilots. You can see an example implementation [here](https://github.com/OpenBB-finance/agents-for-openbb/tree/main/39-vanilla-agent-html-artifacts) if you want your AI to return HTML widgets. Note: This is not yet supported on the OpenBB agent.

---

- #### Tabs Parameter Type

  Implemented a new "tabs" parameter type for widgets, allowing for tabbed interfaces within widget parameters.

---

- #### ATOM Feed Support

  Added support for ATOM feeds to the RSS feed widget, expanding the range of supported feed formats.

---

- #### Parameter Visibility and Ordering

  You can now hide or reorder parameters from the widget settings menu, giving you more control over widget configuration.

---

- #### PDF Export for Multi-Tab Dashboards and Folders

  You can now export dashboards with multiple tabs to PDF, with each tab included in the export. Additionally, you can export entire folders containing multiple dashboards as well.

### Bug Fixes and Improvements

- #### Widget Metadata for Copilot

  Added more metadata information in each widget so Copilot can properly choose the correct widget when responding to queries.

- #### Left Sidebar Layout

  Improved the layout of the left sidebar for better navigation and usability.

- #### Popup Display Fix

  Fixed a few UI issues with popups being partially hidden.

- #### Widget Width on AI Add

  Widgets now have full width when being added to the workspace from AI.

- #### Side Panel Grab Mechanism

  Improved the mechanism to grab the side panels when they are fully closed.

- #### Widget Controls Resizing

  Updated behavior of widget controls when resizing to favor parameters.

## Version 3.2.1 - December 18th, 2025

### Bug Fixes and Improvements

- #### Chart View Pivot Mode

  Fixed an issue with the "pivot mode" in the chart view where the table would get stuck in a "loading" state.

- #### New Sidebar

  Updated the sidebar component to a more streamlined design.

- #### OAuth on Register Page

  Resolved authentication issues with OAuth on the registration page.

- #### PDF Document Support

  Fixed a bug where some files metadata wasn't being read.

- #### MCP Blocked Popup

  Fixed the "blocked popup" notification in the MCP feature, improving the error handling and user notification flow.

## Version 3.2.0 - December 16th, 2025

### New Features

- #### Custom Agent MCP Tool Support

  MCP tools now work seamlessly with custom agents. You can integrate your MCP servers with specialized AI agents to extend their capabilities with custom tools and data sources. Check out our <a href="https://docs.openbb.co/workspace/developers/ai-features/custom-agent-features" target="_blank"><u>documentation</u></a> for details on creating your own custom agents.

---

- #### Widget Controls Visibility Toggle

  Added an option to hide widget controls on all widgets, allowing for a much cleaner viewing experience. Check the widget settings tab to enable this feature.

---

- #### Added OKTA support for Enterprise clients

  Enterprise clients can now use OKTA for SSO to OpenBB Workspace.

### Bug Fixes and Improvements

- #### Widget Row Grouping

  Fixed an issue with WebSocket connections to properly support row grouping. Multiple options can now be selected in widgets and sent correctly to your backend.

- #### Copilot Output Formatting

  Improved formatting of Copilot responses for better readability when presenting complex data analysis.

- #### Backend Connection Errors

  Added more helpful error messages when a backend fails to connect, making it easier to diagnose connection issues.

- #### Widget Parameter Formatting

  Fixed text formatting on some widget parameters for improved clarity.

- #### Shared Dashboard Widget Queries

  Fixed an issue where Copilot couldn't query widgets in a shared dashboard.

- #### Share Icons

  Updated share icons throughout the app.

- #### Search Menu Navigation

  Improved search menu navigation and search functionality.

- #### Onboarding and Data Connectors

  Added ODP links to onboarding and data connectors page for easier access to documentation.

## Version 3.1.0 - November 13th, 2025

### New Features

- #### Streamlined Onboarding Experience

  Onboarding has been updated to reflect recent workspace changes. The new flow now features "OpenBB Sandbox" to showcase platform capabilities and help you get started quickly.

---

- #### Searchable Static Widgets

  Static widgets can now be searched, making it easier to find specific content across your dashboards.

---

- #### Boolean Parameter Grouping

  Boolean parameters can now be grouped together for a better user experience when configuring widget parameters.

---

- #### Base64 Image Support for Apps

  Custom apps now support base64-encoded images for the app image.

---

- #### Image Support in Note Widgets

  Note widgets now support image rendering.

---

- #### AI Prompt Enhancement

  A new "Enhance Prompt" button has been added to the Copilot chat. This feature automatically refines your text input to create more effective prompts.

---

- #### Newsletter Settings Management

  Newsletter settings have been moved to their own dedicated tab in the settings menu (available for free tier users). You can now manage all your newsletter preferences directly within the app.

### Bug Fixes and Improvements

- #### UI/UX Improvements

  - Updated theme colors throughout the application for improved visual consistency.
  - Reorganized the right-click context menu for dashboards and workspace to provide a more streamlined experience.
  - Improved sidebar spacing to better utilize available space on the left side.
  - Enhanced the prompt page and quick add interface to display better when working with large prompts.

- #### Widgets & Data Display

  - Fixed the Pyth widget to function correctly.
  - Resolved an issue where decimal selection was restricted to a minimum of 2 decimal places in tables. You can now select fewer decimal places as needed.
  - Fixed the CellOnClick functionality to allow sending additional values from the same row.
  - Resolved an issue where image exports were not working properly.

- #### AI & Copilot

  - Renamed "Copilot Tables" to "AI Artifacts" for clearer terminology.
  - Fixed an issue where MCP tools could fail when not provided with a description.
  - Improved AI chat ID handling to update correctly as users switch between different chats.
  - Resolved an issue where some AI artifacts would return empty results.
  - Better handling of img's when returned in the chat.
  - Fixed cache ID's sometimes being overwritten during citation - causing the wrong citation to be sent.
  - Added a fix to stop Copilot from saying "the data is now available" when not returning anything.
  - Removed duplicate artifacts in Copilot answers.
  - Changed sampling of data to not peek just the top of the table.
  - Improved AI output formatting and bar chart creation.
  - Added Search functionality for the chats dropdown.

- #### Data Connectors

  - Removed Intrinio and Quartr as data provider options on the free tier.


## Version 3.0.2 - October 13th, 2025

### Bug Fixes and Improvements

- #### Data Connectors & Backends

  - Fixed an issue where the Edit Backend modal was locked after adding or removing a header

- #### Updated UI elements

  - The currently active dashboard now shows when the menu is collapsed in the My Dashboard section
  - The shared icon no longer shows after duplicating a shared dashboard

- #### Charting

  - Added a toggle in widget settings to customize the chart color per category.

## Version 3.0.1 - September 30th, 2025

### New Features

- #### MCP Server Enhancements

  Added search functionality to MCP server menu for quick access to tools.

---

- #### MCP ↔ Widget Citations

  You can now set OpenBB widgets to match MCP tools. When MCP tools are triggered you get the option to add the associated widget. See our <a href="https://docs.openbb.co/workspace/developers/widget-configuration/matching-widget-to-mcp-tool" target="_blank"><u>documentation</u></a> for details.

---

- #### MCP Artifact Generation

  MCP tools now have Artifacts generated, so you can see the underlying data/response from the MCP tool that the agent is utilizing.

---

- #### Localhost MCP Servers

  Now you can add localhost MCP servers to the workspace. Simply check the box when adding your server that it is a local server.

---

- #### Prompt Library

  Save any of your chat message to your Prompt Library for quick reuse.

---

- #### Custom Features for AI Agents

  AI agents can be extended with custom features. You can read more about it in our <a href="https://docs.openbb.co/workspace/developers/ai-features/custom-agent-features" target="_blank"><u>documentation</u></a> here.

### Bug Fixes and Improvements

- #### Data Connectors & Backends

  - Fixed an issue where Edit Backend changes were not being saved correctly.
  - Backend validation during testing now correctly supports both POST and GET endpoints.

- #### AI & Copilot

  - Resolved chat lag that could occur when rendering KaTeX content in the chat window.
  - When using Generate Widget, note widgets now update as expected.
  - Improved error message when max tool calls reached
  - Improved OpenBB Copilot to behave better overall.
  - Fixes to Orchestration mode

- #### MCP Reliability

  - More robust connection handling for all servers.

- #### UI/UX Improvements

  - iFrame widgets now render at full height when displaying HTML content.
  - Various mobile rendering fixes across the workspace.
  - Fixed some theme setting while in light mode.
  - Added custom branding on loading.

## Version 3.0.0 - September 16th, 2025

### New Features

- #### MCP (Model Context Protocol) Integration

  You can now connect MCP servers directly to OpenBB Copilot. This makes it easy to bring in custom tools and data sources. Choose which tools you want available for each session — we recommend keeping the selection under 50 for best performance.

---

- #### Multi-Agent Orchestrator

  OpenBB Copilot can now coordinate multiple specialized AI agents in the same conversation. This allows more complex workflows, with the right agent being called in automatically based on context.

---

- #### Plotly Charts with Raw data

  Charts can now include the underlying raw data. You can flip between a Plotly visualization and an AgGrid table, and Copilot also sees the raw data for cleaner analysis and better responses.

---

- #### Add-in for Excel

  Enterprise users can now pull data from any AgGrid table directly into Excel. Use the ellipsis menu → “Excel Formula” to generate a formula like: `=OBB.WIDGET(<backend name>, <widget name>, {params})`.

---

- #### AG Grid Theme Builder

  Admins can now create and manage custom themes for AG Grid tables and charts. The new theme builder includes a color picker and live preview so you can align the workspace with your brand. This Features is available to admins on enterprise plans.

---

- #### Branding

  On-prem deployments now support deeper branding. Firms can apply their own logos and color schemes for a fully branded internal version of OpenBB Workspace.

### Bug Fixes and Improvements

- #### AI & Copilot Enhancements

  - Generative UI can create markdown widgets
  - Web search toggle to enable/disable access to the web
  - Copilot has access to all dashboard data (across tabs) and understands layout and recent user actions better
  - Allows to create markdown widget with content, name, desc when using Generative UI
  - Improved metadata handling and citation matching.
  - Fixed AI metadata generation for artifacts created by AI
  - Disabled animations on chart artifacts for better user experience
  - Improve overall agentic experience

- #### UI/UX Improvements

  - Sidebar and workspace toolbar redesigned for clearer navigation
  - Better handling of minimized widgets
  - Improved full-screen AI window styling and tagging @ within AI copilot window.
  - More consistent parameter widths for text/number inputs.
  - Allows to center values in a column in AgGrid table
  - Fixed hover height card display
  - Checkbox display logic fixed for single-category widgets.
  - Enhanced hover, tagging, and grouping behaviors.

- #### Stability & Performance

  - Added automatic save on browser unload events
  - Fixed edge cases that would crash app
  - Resolved issue with Copilot storing stale web citations.


## Version 2.5.1 - August 25th, 2025

### Bug Fixes and Improvements

- #### SSRM Mode

  Fixed an issue with columns not displaying correctly

- #### Save popup

  Fixed an issue where the save changes popup wouldn't properly close.

## Version 2.5.0 - August 18th, 2025

### New Features

- #### Sparkline Support

  Added the ability to create Sparklines (mini charts) within a table widget. You can find more information in our <a href="https://docs.openbb.co/workspace/ssrm_mode#table-widget-with-sparklines" target="_blank"><u>documentation</u></a>.

---

- #### Markdown Files

  Added support for markdown files to be uploaded and processed by our copilot/workspace.

---

- #### New Login/Register Design

  Updated the design of our login/register page.

### Bug Fixes and Improvements

- #### SSRM Bug

  Fixed an issue with dropdowns not working in SSRM mode.

- #### Apps

  Fixed an issue with widget/parameter grouping and selection.

- #### Parameter Calls

  Fixed an issue where the AI agent wouldn't pass the correct parameter to the backend to call correctly.

- #### Citation Fix

  Fixed an issue with "scroll to widget" vs "add widget to dashboard" on citations.

## Version 2.4.0 - August 6th, 2025

### New Features

- #### AI Chat

  Updated the AI chat window with a new design to better reflect our product's aesthetic.

- #### Inline Citations

  Introduced inline citation support for AI-generated answers, allowing users to easily verify the source of information.

---

- #### SSRM Mode

  Enabled Server-Side Rendering Mode (SSRM) for table widgets, which allows for handling much larger datasets than previously possible. You can find more information in our <a href="https://docs.openbb.co/workspace/ssrm_mode" target="_blank"><u>documentation</u></a>.

---

- #### Plotly Raw Data

  Added the ability to send Raw data behind a Plotly chart to better work with the AI copilot. Check the documentation <a href="https://docs.openbb.co/workspace/data-widgets/plotly-charts#plotly-chart-with-raw-data" target="_blank"><u>here</u></a> for how to to add to your backend.

### Bug Fixes and Improvements

- #### Chat Rendering

  Fixed minor rendering bugs in the AI chat for a smoother user experience.

- #### Search Performance

  Enhanced search performance to deliver faster and more relevant results.

- #### AI Responses

  Resolved an issue that could cause the AI to become unresponsive during a conversation.

- #### AI SQL Mode

  Improved the SQL mode for OpenBB Copilot to better handle standard and SSRM tables.

- #### UI for Toasts

  Updated the UI for toast notifications to align with the application's modern styling.

## Version 2.3.0 - July 16th, 2025

### Bug Fixes and Improvements

- #### Backend Connection Timeout

  Increased timeout duration when adding a backend connection.

- #### Theme Simplification

  Updated our theme design to be more streamlined and consistent throughout the product.

- #### AI Chat Window Enhancement

  Added the ability to expand the AI chat window to full size.

- #### Widget Parameter Fixes

  Fixed an issue where some widget parameters were not working correctly with their default values.

- #### Date Function Support

  Enhanced apps.json to support date functions - making it behave the same as the widgets.json.

- #### Plotly Widget Improvements

  Resolved various UI issues with Plotly widgets and improved export functionality.

- #### @ Widget Functionality

  Enhanced the @ widget functionality with improved menu selection.

- #### Render Function Enhancements

  Fixed hovercard display and highlighting issues when multiple render functions are passed to a widget.

- #### AI Event Improvements

  Updated AI events to provide more helpful and contextual information while chatting.

- #### Markdown Widget URLs

  Added the ability to open markdown widget URLs directly inside the workspace if allowed.

## Version 2.2.0 - June 30th, 2025
### Bug Fixes and Improvements

- #### Authentication Headers

  Authentication headers now work correctly for app images.

- #### AI Chat

  Improved web citation hover behavior and highlighting of reasoning steps during chat output.

### Breaking Changes

- #### Benzinga and Econdb

  Benzinga and Econdb data are no longer supported. This affects the Global News, Company News, Analyst Price Target, Economic Overview, Country and Economic Indicators, and Yield Curve widgets.

## Version 2.1.0 - June 18th, 2025

### New Features

- #### Omni Widget

  Introducing the new Omni widget - a versatile, multi-purpose widget type that can adapt to various data visualization needs. Check our documentation for how it works <a href="https://docs.openbb.co/workspace/data-widgets/omni" target="_blank"><u>here</u></a>. We're excited to see what you build with it!

---

- #### Widget Parameter Positioning

  Enhanced widget <a href="https://docs.openbb.co/workspace/widget-parameters/parameter-positioning" target="_blank"><u>parameter controls</u></a> with improved positioning options, giving you more flexibility in customizing the widget layout.

---

- #### Multiple Text Inputs

  Added <a href="https://docs.openbb.co/workspace/widget-parameters/text-input#multiple-options-text-input" target="_blank"><u>dynamic text input functionality</u></a>, this feature allows for more flexible data entry within widgets.

---

- #### Prefix and Suffix Support

  You can now add custom prefixes and suffixes to column values. Check out our <a href="https://docs.openbb.co/workspace/widgets-json-reference" target="_blank"><u>documentation</u></a> for implementation details.

---

- #### Excel Integration Enhancements (Enterprise)

  - Improvement of Excel formulas on widgets
  - Table widgets (with right permissions) brought by users are now accessible in Excel Add-In
  - Export dashboard data to Excel (one widget data per sheet)
  - Export all widget formulas (one per sheet)

---

- #### Send to Agent Feature

  The `sendToAgent` action type allows users to click on table cells to send contextual data directly to an AI agent for analysis. This is particularly useful for getting insights about specific data points or rows. Check how <a href="https://docs.openbb.co/workspace/widget-configuration/render-functions#send-to-agent" target="_blank"><u>here</u></a>

---

- #### OpenBB AI SDK

  We've released the new <a href="https://github.com/OpenBB-finance/openbb-ai" target="_blank"><u>openbb-ai repository</u></a>, which provides the core SDK for building custom agents for OpenBB Workspace. Combined with our <a href="https://github.com/OpenBB-finance/agents-for-openbb" target="_blank"><u>agents-for-openbb repository</u></a> which offers practical examples and templates, you now have everything needed to create specialized AI agents tailored to your specific workflows and requirements. Whether you're looking to build agents that handle raw data, generate charts, process PDFs, or create custom reasoning workflows, these repositories provide both the tools to get you started.

### Bug Fixes and Improvements

- #### AI Document Handling and Context

  Significantly improved document processing performance - we can now handle documents over 1,000 pages long with enhanced reliability. Our AI capabilities have also been upgraded with a new and improved language model which greatly increases our context limits.

- #### Dark/Light Mode Fixes

  Fixed many display issues in both dark and light mode themes.

- #### Multi-File Viewer Improvements

  Added collapse and expand functionality in the sidebar for multi-file viewer widgets, providing better navigation and organization.

- #### Admin Panel Enhancements (Enterprise)

  Fixed import functionality in the admin panel when inviting multiple users.

- #### Plotly Chart Controls

  Updated Plotly modebar functionality with improved chart interaction controls.

### Breaking Changes

- #### Multi File Viewer Widget

  We've switched how the multi-file viewer handles fetching files. Existing implementations will still work, but you will see a popup if you are using the old way.
  You can check the <a href="https://docs.openbb.co/workspace/data-widgets/file-viewer#multi-file" target="_blank"><u>documentation</u></a> here on how to update.

## Version 2.0.2 - May 14th, 2025

### Bug Fixes and Improvements

- #### Copilot Chat

  Fixed an overflow bug on some text in the Copilot chat window. Also disabled switching chats while a message is streaming.

- #### Admin Panel (Enterprise)

  Updated a few features in the Admin panel to help improve the user experience. Mostly around inviting users and managing user roles.

- #### Table Widgets

  Fixed a few visual issues with table widgets not having the correct column size on load.

- #### UI/UX

  Various UI/UX improvements - especially around the sidebar and dashboard.

- #### Export App

  Fixed a bug where the export app was not correctly exporting all the widget settings.

## Version 2.0.1 - May 8th, 2025

### Bug Fixes and Improvements

- #### Multi-File Viewer

  Fixed a bug where the selection of a file was not working when creating a new chat.

- #### Charting

  Fixed a bug where a chart would crash if the page was refreshed.

- #### Undo Button

  Added a close button to the undo popup - previously this wouldn't save your choice by exiting.

  Fixed a bug where the undo button was not working in the Copilot chat.

- #### Render Functions

  You can now pass multiple values to the <a href="https://docs.openbb.co/workspace/widget-configuration/render-functions" target="_blank"><u>render function</u></a>.

## Version 2.0.0 - April 30th, 2025

### New Features

- #### Apps

  Custom Apps allow you to define and manage the layout and behavior of widgets on your dashboard. Apps are a combination of widgets, prompts, and agents. Previously these were referred to as templates but we've redesigned how templates work to create the App's concept. You can check out the more detailed blog post <a href="https://openbb.co/blog/introducing-openbb-apps-tailored-by-users-for-optimized-workflows" target="_blank"><u>here</u></a> for more information.

---

- #### Role Based Access Control

  For Enterprise users, we've added Role Based Access Control. This allows you the Admin to control what users have access to certain widgets, apps, and prompts. You can also share the apps, widgets, and prompts globally with your team in a few simple steps. You can check out the documentation <a href="https://docs.openbb.co/workspace/enterprise" target="_blank"><u>here</u></a> for more information.

---

- #### Newsfeed Widget

  Added a new newsfeed widget that allows you to present data in a widget and open the underlying data to the news article. You can find an example implementation <a href="https://docs.openbb.co/workspace/data-widgets/newsfeed" target="_blank"><u>here</u></a>.

### Bug Fixes and Improvements

- #### Documentation

  Updated and revamped our <a href="https://docs.openbb.co/workspace" target="_blank"><u>documentation</u></a> to help you better understand how to integrate apps, widgets, and agents into the workspace.

- #### Multi-File Viewer Widget

  Enhanced the design of the multi-file viewer widget to be more user and agent friendly.

- #### Web Search

  We are now utilizing ChatGPT for web search instead of Perplexity

- #### Visual Improvements

  Improved the visual design of the light mode to be more consistent.

- #### Search Menu

  Improved the search menu to return more relevant results based on the query.

### Breaking Changes

- #### Trading Economics data

  Trading Economics data is no longer supported - This affects the Earnings Calendar widget only.

## Version 1.3.1 - April 3rd, 2025

### New Features

- #### New Search Menu

  Updated our search menu to be more user friendly and easier to use. You can now see a better breakdown by category and sub-category, multiselect and more.

### Bug Fixes and Improvements

- #### Export Template

  Added a feature to copy the exported template to your clipboard and fixed a few layout issues on the Template page.

- #### Resizing Widgets

  Fixed a bug where table columns were not sizing correctly when a parameter was changed.

### Breaking Changes

- #### ETF and Estimates data

  ETF and estimates data from Intrinio is no longer supported.
  The free tier is not affected by this change.
  Additional details have been sent via email to those impacted.


## Version 1.2.1 - March 26th, 2025

### Bug Fixes and Improvements

- #### Built in Charts

  Fixed a bug where charts would not save their settings correctly on logout.

- #### Table Columns

  Fixed a bug where table columns size was not being saved correctly when loading a new tab.

- #### Copilot Chat

  Some old chats could not be deleted - this has now been fixed.

- #### API Key Management

  AI keys were previously being cleared when a new version was released, this is no longer the case.

## Version 1.2.0 - March 18th, 2025

### New Features

- #### @ Widgets

  Added the ability to @widgets in the Copilot chat. This will add the widget as context - and query it quickly without having to add the widget to the dashboard or click the "add to context" button. You can also use @widgets in the Prompt Library.

----

- #### Custom Backend Updates

  - **Live Grid Widget** - A widget that can display real-time data updates for a table, updating one or all columns. <a href="https://docs.openbb.co/workspace/data-widgets/live-grid" target="_blank"><u>Documentation</u></a>
  - **Advanced Charting Widget** - Allows users to bring their own data to the charting widget. <a href="https://docs.openbb.co/workspace/data-widgets/tradingview-charts" target="_blank"><u>Documentation</u></a>
  - **Multi-File Viewer Widget** - A widget for viewing multiple files simultaneously (currently supports PDFs only). <a href="https://docs.openbb.co/workspace/data-widgets/file-viewer" target="_blank"><u>Documentation</u></a>
  - **Multi-Grouping Parameters** - You can now group by multiple parameters in any widget if they match. Previously, grouping was limited to a single parameter. <a href="https://docs.openbb.co/workspace/widget-parameters/parameter-grouping" target="_blank"><u>Documentation</u></a>
  - **Form Parameters** - Added support for form parameters in custom backend widgets, allowing users to send data to the backend as a form from within the widget. <a href="https://docs.openbb.co/workspace/widget-parameters/input-form" target="_blank"><u>Documentation</u></a> (Currently disabled for Copilot interaction.)

----

- #### Copilot Charts

  OpenBB Copilot now supports angle and pie charts.

- #### Widget Controls

  Widgets can now be minimized and maximized through widget controls.

### Bug Fixes and Improvements

- #### Performance Improvements

  Improved workspace performance by reducing unnecessary re-renders

- #### Charting Widget

  Fixed a bug where users could not select a candle type after changing it once.

- #### Copilot Chat

  Fixed a bug where OpenBB Copilot would repeat responses in the chat.

- #### Live Watchlist

  Fixed a bug where the live watchlist was not returning the correct symbols to OpenBB Copilot.

- #### Chart Settings in Template

  Chart settings are now retained when exporting a template.

## Version 1.1.0 - February 13th, 2025

### New Features

- #### Name Change

  Changed Application name to "OpenBB Workspace" for the free version and "OpenBB Enterprise" for the paid version.

----

- #### Custom Backend Updates

  - **PDF Widget** - Added support for PDF files as a type of backend widget you can now add. These can come as presigned URLs or base64 encoded. <a href="https://docs.openbb.co/workspace/data-widgets/file-viewer" target="_blank"><u>Documentation</u></a>
  - **Conditional Color Rendering** - Added support for conditional color rendering in cells. <a href="https://docs.openbb.co/workspace/widget-configuration/render-functions" target="_blank"><u>Documentation</u></a>
  - **Image Support in Custom Templates** - Added support for images on custom templates. <a href="https://docs.openbb.co/workspace/apps" target="_blank"><u>Documentation</u></a>
  - **Run Button for Custom Backend Widgets** - Added a Run button for custom backend widgets, allowing you to only run the widget parameters on click. <a href="https://docs.openbb.co/workspace/widget-configuration/run-button" target="_blank"><u>Documentation</u></a>
  - **HoverCard Support** - Added support for HoverCard on a custom backend table. <a href="https://docs.openbb.co/workspace/widget-configuration/render-functions#hover-card"><u>Documentation</u></a>
  - **Prompts in Custom Templates** - Added ability to add prompts to your custom templates. <a href="https://docs.openbb.co/workspace/apps" target="_blank"><u>Documentation</u></a>
  - **Theme Parameter for Plotly Charts** - Added Theme parameter to plotly charts, enabling native switching between light and dark mode when creating a custom backend. <a href="https://docs.openbb.co/workspace/data-widgets/plotly-charts" target="_blank"><u>Documentation</u></a>

----

- #### 2FA for Users

  Allowed any user to enable 2FA. Go to your profile and under Security - Enable 2FA.

### Bug Fixes and Improvements

- #### URL Error Fix

  Fixed error when clicking on a non-existent URL in Copilot chat or Workspace.

- #### Template State

  On export, the template state is saved, allowing you to restore the template to the same state it was in when it was exported.

- #### Plotly Charts Data Passing

  Fixed a bug where some plotly charts weren't passing data to OpenBB Copilot correctly.

- #### Copilot Intelligence

  Improved Copilot intelligence around documents, summaries, and artifacts.

- #### Sentence-Level Highlighting

  Improved sentence-level highlighting for PDF citations in OpenBB Copilot.

## Version 1.0.8 - January 21st, 2025

### New Features

- #### Widgets 2.0

  Experience the next generation of widgets, which enables Copilot to access and modify input parameters dynamically.

----

- #### Earnings Transcripts and Calendar Widget

  Introducing the Earnings Widget and Earnings Calendar, powered by Quartr, to help you stay on top of key updates during this earnings season. We've also added an Earnings Template to help you get started.

----

- #### PDF Highlighting

  Added a new feature to the PDF widget/Copilot where citations on hover now highlight the sentence in the PDF.

----

- #### Prompt Library for Copilot

  Added a <a href="/app/prompt-library"><u>Prompt Library</u></a> which allows you to save and reuse prompts for Copilot quickly. These prompts can be accessed by clicking the lightbulb icon in the Copilot chat after adding.

### Bug Fixes and Improvements


- #### Shortcuts Menu
  Added a new Shortcuts Menu in the account settings menu (top left) to help you quickly navigate around the app.

- #### Copilot Chat
  Fixed a few visual bugs in the copilot chat due to resizing the chat window.

- #### Widget Descriptions
  Updated the descriptions for some widgets to allow Copilot to access and modify input parameters dynamically. This will be an ongoing effort to improve Copilot's ability to interact with widgets.

- #### News Widget Crash
  Fixed a bug where the news widget would crash if it was added via template.

- #### Sidebar Shortcut
  Fixed a bug where the sidebar shortcut would not correctly hide/show the sidebar.

### Breaking Changes

- #### Custom Copilots

  If you've built a custom Copilot, you'll need to update your Copilot to work With widgets 2.0. There is a migration guide available <a href="https://github.com/OpenBB-finance/copilot-for-openbb"><u>here</u></a>.

## Version 1.0.7 - January 9th, 2025

### New Features

- #### New Walkthrough

  Introducing an interactive walkthrough tailored to your needs: choose between AI-powered research or building a custom app. You can access them in the <u> [Help and Documentation](/app/help-documentation)</u> section.

---

- #### Improved Custom Backend Documentation

  Improved the documentation for custom backends to make it easier to understand how to use them. Check it out [here](https://docs.openbb.co/workspace/data-integration). The new changes include :
  - Two new widget types - `Markdown` and `Metric`
  - Custom Dropdown lists via endpoint
  - Ability to group custom widgets with a shared dropdown
  - Setting up your own Templates

### Bug Fixes and Improvements

- #### Charting Widget
  Now saves your indicators / changes correctly when leaving the dashboard and you can create layouts.

- #### Widgets Parameters
  Fixed an issue on some widgets where the dropdown value didn't save when changing dashboards.

- #### Pyth Price Feeds
  Improved performance by only subscribing to selected price feeds. Fixed a bug where feeds would continue running after closing the widget.

## Version 1.0.6 - December 20th, 2024

### Bug Fixes and Improvements

- #### Copilot Chat
  Fixed a bug where Copilot was not rendering some text in the chat correctly.

- #### Copilot Counter
  Removed the counter for the number of messages remaining in the chat and replaced it with a more appealing visual indicator.

- #### Date Picker
  Updated the date picker to be consistent with the date picker in other parts of the app.

- #### Drag and Drop Files
  Fixed a bug related to drag and drop files in the dashboard when the user was at the bottom of a large dashboard.

- #### Historical Stock Price Widget
  Allowed users to select ETFs in the historical stock price widget.

- #### Registration
  Fixed a bug where some users were not able to register using the "Sign in with Google" option.

## Version 1.0.5 - December 13th, 2024

### New Features

- #### File Types
  Added ability to add text (.txt) and markdown (.md) files.

- #### Data Connectors Page
  Reworked the Data connector page to allow for bulk selecting/deleting/adding widgets to your dashboards. You can now manage your backend connections quicker and easier.

### Bug Fixes and Improvements

- #### Welcome Page
  Some minor fixes to responsiveness on the Welcome page.

- #### Error Messages
  Updated some error messages to be more descriptive to the user.

- #### Copilot Error Message
  Fixed a bug where the Copilot would not display an error message in the chat if the question failed.

- #### [PRO] Shared Files
  Shared files in a dashboard can now be accessed by OpenBB Copilot.

- #### Yield Curve Widget
  Fixed yield curve widget to have correct parameters when being accessed by OpenBB Copilot.

- #### Price Target Widget
  Fixed price target widget hover behavior to accurately represent the correct dates on price targets.

## Version 1.0.4 - December 3rd, 2024

### Bug Fixes and Improvements

- #### Copilot Data Processing
  Copilot is now much better at answering queries that require multiple pieces of data retrieved from the dashboard or directly.

- #### Added Folders to Sidebar
  Previously, folders were not appearing in the sidebar. This has now been added.

- #### Processing Artifacts in Chat
  There was an error when processing artifacts if a message was edited.

- #### Error When Processing XLS Files
  Removed support of XLS files, as we only support XLSX files from Excel.

- #### Various Visual Improvements
  Fixed some icon rendering / visual styling.

## Version 1.0.3 - November 25th, 2024

### New Features

- #### Copilot Feedback
  OpenBB Copilot now includes a feedback system that allows you to provide feedback on your experience. The feedback option is only available for new chat messages - previous messages will not have this option. We welcome your feedback as we use it to improve OpenBB Copilot.

- #### Copilot Chart Generation
  OpenBB Copilot can now generate visual charts and plots in response to your queries. These visualizations appear as interactive artifacts within the "reasoning steps" section of the chat window. Currently supports:
  - Line charts
  - Bar charts
  - Scatter plots

  Try it out by asking OpenBB Copilot: "show me a chart of the closing price for AAPL in 2024"

- #### Copilot Inline Artifacts
  OpenBB Copilot can now display inline artifacts in the chat window. These artifacts will appear as a table or chart directly in the chat window.

- #### Upload Files to Dashboard
  You can now upload files to your dashboard by dragging and dropping them into the dashboard.

- #### New Widget - Yield Curve
  Added a new widget to visualize the yield curve by country.

- #### New Widget - EOD Options
  Added a new widget to visualize EOD options data.

### Bug Fixes and Improvements

- #### File upload
  Fixed a bug where file upload progress was not working correctly for multiple files.

- #### Price Target by Analyst
  Changed the price target by analyst widget to now show the adjusted price target - previously it was showing the unadjusted prices.

- #### Custom Copilot
  You can now pass through headers to your custom Copilot - allowing for authentication headers to be used.

- #### Copilot Chat
  Fixed a bug where Copilot chat would rerender too often, causing performance issues.

- #### Copilot Metadata
  Added ability to add metadata to Copilot artifacts when added to the dashboard.

- #### Custom Backend
  Changed the behavior of true/false parameters to be handled as a checkbox in the widget top bar.

- #### Improved Search View/Filter
  Made some data tags more prominent in the search view as well as improving the filter when searching for files/widgets.

## Version 1.0.2 - October 29th, 2024

### New Features

- #### Pyth Network Widget

  Added a new widget using the Pyth Network which allows users to access
  456 feeds covering mainly Crypto, but also Equity, FX, and Commodities,
  with snapshots available for 400ms, 1-hour, 1-day, and 7-day intervals.
  This widget must be enabled on the [Data Connectors Page](https://pro.openbb.co/app/data-connectors?tab=packaged-data).

### Bug Fixes and Improvements

- #### Copilot Chat
  Made some actions (copy, refresh, etc.) only show on hover of a message - cleaning up the view in the chat window.

- #### Mobile Fix
  Allowed users to now click on citations on mobile.

- #### Copilot Chat Errors
  Fixed a bug related to old Copilot chats responding with errors.

- #### Symbols in Charts
  Fixed a bug where a "-" in symbols caused that symbol to not return any data.


## Version 1.0.1 - October 24th, 2024

### New Features

- #### OpenBB Copilot: Files as widgets
  OpenBB Copilot now treats widgets that display PDFs and images as widgets (previously, files were treated as separate entities in the Copilot window).

- #### OpenBB Copilot: Bring your own API keys
  You can now bring your own OpenAI and PerplexityAI API keys to OpenBB Copilot. Adding your own keys will allow you to bypass the daily query limit.

- #### OpenBB Copilot: New Citation System
  OpenBB Copilot now features a new citation system that is dramatically more accurate and reliable than before. These citations will appear underneath OpenBB Copilot's answers. Hovering your cursor over these citations will allow you to scroll to the source, add a widget to the dashboard (in the case of retrieving data directly), and more.

- #### PWA App Release
  Our app can now be installed on any device as a PWA app. See our blog post <u> [here](https://openbb.co/blog/openbb-terminal-is-now-available-on-mobile)</u> for more information on what this means.

- #### Sign-in with Google
  We've added a "Sign in with Google" option - we will be adding more quick sign in options in the future.

- #### Widget Bundles and TradingView Widgets
  You can now turn widgets on and off from the Packaged Data tab inside the Data Connectors Page. You can also add the new TradingView widgets from this page.

- #### Charting Math
  On the Charting widgets with TradingView you can now do some basic math on the charting symbols. Try it out with an example like AAPL-MSFT to see a comparison chart.

- #### Updated Search and Filters
  The search now has a new look - We've removed some tabs and streamlined the interface to make it easier to find what you need. In addition to the new look you can filter based on your search as well, for example searching "pdf" will return all pdf files.

- #### New Onboarding Template
  A new onboarding template has been added to better inform users about how to take advantage of various features.

### Bug Fixes and Improvements

- #### @web search
  An edge case when using @web search, leading to an error, has been fixed.

- #### OpenBB Copilot chat "soft-lock"
  An edge case where a OpenBB Copilot retrieves a widget from the dashboard, and then the user adds a widget explicitly as context, leading to a soft-lock has been fixed.

- #### OpenBB Copilot improved image handling
  The image handling of OpenBB Copilot has been improved.

- #### OpenBB Copilot improved structured context handling
  A large number of errors and edge cases have been fixed with structured context handling in OpenBB Copilot.

- #### OpenBB Copilot faster summarization of multiple PDFs
  When summarizing multiple documents, OpenBB Copilot has greatly improved performance.

- #### OpenBB Copilot now asks for guidance if it could not find a data source
  In instances where OpenBB Copilot was unable to automatically find a data source, it will now ask you for guidance.

- #### OpenBB Copilot has better error handling for LLM provider errors
  Error messaging and error handling around LLM provider errors have been improved.

- #### OpenBB Copilot has improved reasoning step descriptions
  OpenBB Copilot's reasoning steps have been improved with better descriptions, and more reasoning steps describing the actions being taken by OpenBB Copilot.

- #### Filtered Data
  Filtered table data is now correctly sent to OpenBB Copilot.

- #### Widget Bugs
  Fixed a few bugs related to widgets including duplicating widgets, column ordering, and navigation bar widget not displaying tab names correctly.

- #### Google Translate Bug
  Fixed a bug that caused Chrome to crash when the page was translated to a language other than English.

- #### Custom Backends
  Added header tooltips to backend widgets as well as widgets showing a proper error message if failures occur.


## Version 1.0.0b - September 5th, 2024

### New Features

- #### New OpenBB Copilot Features and Improvements

  - OpenBB Copilot has dramatically improved PDF, text, and image file handling intelligence.
    - OpenBB Copilot has improved its searching capabilities for PDFs and text files.
    - OpenBB Copilot can now produce detailed summaries for PDFs and text files.
    - OpenBB Copilot can now search, summarize, and query multiple PDFs or text files while answering your query.
  - OpenBB Copilot Status Updates
    - OpenBB Copilot now produces status updates and notifications in the chat window to let you know what OpenBB Copilot is doing when accessing data.
  - Artifacts as part of Status Updates
    - Status Updates can include artifacts (either in text form or a table).
    - These artifacts can be summaries, tabular outputs produced by OpenBB Copilot, and more.
    - These artifacts can be used to create new widgets directly.
  - Multiple chats
    - By popular request, you can now save and restore the various conversations you've had with OpenBB Copilot.
  - Web search
    - OpenBB Copilot can now search the web. Activate web search mode by adding "@web" in your query.
    - Note: web search will not utilize any context, attached files, or your dashboard.
  - Direct Retrieval
    - OpenBB Copilot can now directly retrieve and use data from widgets and custom endpoints even when they are not displayed on the dashboard.
    - For best results with custom endpoints, descriptive names and descriptions are recommended.

---

- #### New Data Connectors Page and Packaged Data

  - We've completely redesigned our data connectors page to make it simpler to use. Now everything is in one place
  and you can quickly add more connections in a few clicks.

  - We have a new tab on the Data Connectors page to control what widgets you can see in your search.
  You'll be able to turn widget packages or single widgets provided by OpenBB on or off here.

  - Along with this we have also updated our documentation about adding custom backends - it can be found <u>[here](https://docs.openbb.co/workspace/data-integration)</u>

---

- #### Metadata

  You'll notice many widgets now have "metadata" associated with them in the settings when you add data connectors.
  This metadata allows you to give our Copilot even more info to correctly process your files and data.

---

- #### AI-generated Titles, Metadata, and Chat Titles

  We've added a few features to allow our AI to help you come up with more specific naming and metadata info. If you don't want this help, you can turn this feature off in the Settings menu.

---

- #### ChartView

  There's a new button on most widgets, located in the upper right, that allows you to quickly render a chart using the data from the table.

---

- #### News and Charting Tab

  We've removed the News and Charting tab from the sidebar and made these available as dashboards in our template library.

### Bug Fixes and Improvements

- #### Copilot

  - Improved citations: OpenBB Copilot is now far more reliable when citing accessed files, widgets, and data sources.
  - Various fixes and improvements to make OpenBB Copilot more reliable.

- #### Custom Backend

  We now allow users to Add Authentication to their backend. If you have a hosted backend you can now pass auth in
  a header or query parameter.

- #### Sidebar Behavior

  Various improvements have been made to the dashboard sidebar. Dragging and dropping dashboards and folder creation
  behaves more predictably.

- #### Column Behavior

  Added some logic to improve the handling of initial value types in a column. Previously, some data that should have been allowed to be charted was not.

### Breaking Changes

- #### Custom Backends and Widgets.json

  We've changed how parameters are passed on custom backends; if you were previously
  sending parameters to your backend please check out the new documentation <a href="https://docs.openbb.co/workspace/widgets-json-reference"><u>here</u></a>.

## Version 0.4.1b - July 23rd, 2024

### New Features

- #### New OpenBB Copilot Features and UI

  - OpenBB Copilot has been overhauled and moved to a side console on the right-hand side of the screen.
  - Major accuracy and robustness improvements - OpenBB Copilot has massively improved handling of structured data.
  - Chat history - You can now save and return to previous conversations.
  - Message editing - You can now edit prior messages in a conversation and generate new responses.
  - Improved citation behavior and visuals.

---

- #### Multiple File Upload

  You can now upload multiple files at one time in the Data Connector tab.

---

- #### Country Economics Template + Economic Indicators Widget

  We've added a new dashboard template for Country Economics. Now you can
  research country-specific economic indicators, including GDP, inflation, and unemployment rates
  for different countries.

- #### Revenue and Earnings Trends Widgets

  Added two new widgets to our Equity Template under the "Estimates" tab. These new widgets include
  yearly and quarterly financial forecasts for Revenue and Earnings.

### Bug Fixes and Improvements

- #### News Menu

  Fixed some dropdowns on the menu.

- #### Single Widget

  Fixed the single widget popup - before it wasn't saving some values causing unexpected failures when
  adding a URL.

- #### Search Behavior

  Improved the search button interface and allowed users to ask questions to the Copilot from the search.

## Version 0.4.0b - June 28th, 2024

### New Features

- #### New Chart Types and Zooming

  Introduced new chart types and added zooming capabilities to all charts -
  check them out on the chart settings menu the next time you create a chart.

---

- #### Widget Sharing

  You can now share Single, Advanced, and File widgets.

---

- #### Country Indicators Widget

  Added a new widget under Economy that gives you an overview of economic
  indicators for a given country.

### Bug Fixes and Improvements

- #### Sidebar Enhancements

  Fixed dragging on the sidebar and made it easier to drop dashboards into a folder.

- #### Copilot

  Adjusted some button sizes for a more user-friendly interface and
  added protection against some table views. We also added text completion with
  the Right Arrow key.

- #### Text Widget

  Allow markdown headings to work inside a text widget.

- #### PDF Rendering

  Changed PDF rendering in file widgets to display one page at a time,
  significantly improving performance. Also, added controls to zoom in/out
  and navigate pages more easily.

- #### Icon Rendering Fixes

  Resolved various icon rendering issues.

- #### Data Connector

  Added better sorting and search capabilities under Data Connector in the "My Widgets" tab.

## Version 0.3.9b - June 5th, 2024

### New Features

- #### Dashboard Sharing

  You can now share your dashboards with anyone in your Entity. Simply
  right click on your dashboard in the left navbar
  and click Share. A shared dashboard will allow the user to see everything as
  you do.
  You will be allowed some changes to the widgets
  but mostly it is a static page. While this is an Enterprise feature, we are
  allowing you to share with someone on a trial account as long as you know their email.

---

- #### Copilot Colors

  We wanted to really make our Copilot stand out and our design team came up with a great
  way to do that. Enjoy the new color scheme for our OpenBB Copilot.

---

- #### Comparison Template

  Added the Comparison Template to our library of prebuilt dashboards. This template
  allows you to quickly compare any two companies' performance, including valuation
  multiples, analyst estimates, price performance, and price targets.

---

- #### Nextla TimeGen-1 Forecasting

  Forecasting has never been easier with Nixtla and OpenBB.

    To get started -

  - Create a line chart from any data on a table and then

  - Click the Nixtla button in the top right of the graph <Icon id="nixtla-icon" className="w-3.5 inline-block" />
  - Set your forecasting parameters and you are ready to go.

---

- #### PDF Uploading

  We've added the ability to upload PDFs to our "Data Connectors" page. Once uploaded
  you will be able to interact with it seamlessly with our Copilot!

---

- #### Raw Data / Chart Toggle

  Some widgets (Valuation Multiples and Revenue Per Business Line / Geography)
  will have a new icon to easily switch between the raw table view and a predefined
  chart. Look for more of our widgets to have this ability in future releases.

### Bug Fixes and Improvements

- #### Improve Booking and Feedback Bar

  We've updated the bottom sidebar to be more concise and offer you the ability to invite users,
  submit feedback, and schedule a demo.

- #### Improved Copilot Prompts and Response times

  Some of our predefined prompts have been updated and we've switched to a faster model.

- #### Duplicate Dashboard Bug

  Fixed a bug that wouldn't allow you to change any values on a duplicated dashboard.

### Breaking Changes

- #### Company Calendar Tab

  Inside our Equity Template, the Company Calendar tab has been given a facelift.
  Previous Tabs to this version won't see the update but any new Equity Templates
  will have the new design.

## Version 0.3.8b - May 15th, 2024

### New Features

- #### Current Currency

  Added small text to the bottom of many widgets to indicate the current currency being used.

### Bug Fixes and Improvements

- #### Visual Improvements

  Updated styling for many components within the App, including tooltips, onboarding, and data connectors.

- #### Widget Errors and Webpage Crash

  Fixed a bug that would crash the webpage if you had Copilot open and deleted the dashboard. Also fixed a few errors related
  to widgets and grouping.

- #### Watchlist Widget

  Improved the loading mechanism for the Watchlist Widget.

- #### Data Connector

  Fixed a bug not allowing users to sort/filter on certain columns.

## Version 0.3.7b - May 7th, 2024

### New Features

- #### Copilot Suggestions

  We've added suggested prompts to many widgets and dashboards when you open the Copilot chat.
  These prompts are there to guide you towards better understanding of Copilot's capabilities.

---

- #### New ETF Widgets

  We have added two new widgets for the ETF asset class - ETF Classification and Characteristics.
  We've also updated a few other widgets to show data that is relevant to ETF's when rendered.

---

- #### Widget Refreshing

  You can now refresh widgets manually by clicking on the button in the navbar (top right green or yellow icon) over each widget. Or you
  can right click on the dashboard and refresh all widgets.

---

- #### Load Data from File

  We've added the ability to load a JSON or CSV file as a table widget using the "Data Connectors" page.

---

- #### Improved Answers for certain widgets explicitly added to OpenBB Copilot's context

  OpenBB Copilot now provides much more accurate answers for certain widgets that are explicitly added to OpenBB Copilot's context, if the widget contains sufficiently large structured (i.e. tabular) data. More complex queries and calculations such as averages, sums, counts, comparisons and more are now possible.

### Bug Fixes and Improvements

- #### Speed Improvements

  Added more improvements to the speed and handling of widgets. Most notably the News widgets and Comparison Analysis widget. Other
  caching mechanisms were added to improve performance as well.

---

- #### Widget Copy Bug

  Fixed an issue related to widget size storage where a copied widget wouldn't keep its same size. This bug also related to some
  widgets in a data connector not remembering their size when the dashboard was refreshed.

---

- #### Input Text Bug

  Fixed an issue with text being overwritten in a search box.

---

- #### Bring your own Data

  Fixed an issue related to Plotly charts rendering correctly and tables not showing all data. Also made a few changes
  on how often the data is called. We also updated our documentation to better show how to add a widget - This can be found
  on the "Data Connectors" tab.

---

- #### Input selection changes

  Updated many selection inputs to be radio instead of checkbox.

---

- #### Administration updates

  Added a few bug fixes to the administration section when managing your account and user accounts within your organization.

---

- #### Grouping Logic

  Added handling to the grouping logic so ETF's or other asset classes can only be grouped with widgets that are valid for that asset type.

---

- #### Improved Vision for OpenBB Copilot

  We have further improved the vision capabilities of OpenBB Copilot. OpenBB Copilot takes into consideration the structure of images, as well as numerical values and units
  that are displayed in images added to the context, and provides much more detailed answers and analysis.

## Version 0.3.6b - April 19th, 2024

### New Features

- #### Why It's Moving

  We've updated our Ticker Information Widget to include a "Why It's Moving" graphic.
  If the stock is trading outside its normal range you can hover over the text under the Price and Day's change to see why.
  Data is provided by Benzinga.

---

- #### Currency Snapshot Widget

  Forex has made it's way into the Platform. You can now see key metrics across various base and counter currencies.

---

- #### New Template - World Economics

  We've updated the old Calendar template to now include the previously mentioned Currency Snapshot.
  You can find it in the template section - if you had a previous template you will need to re-add this one.
  Look for more changes to this in template in the future.

### Bug Fixes and Improvements

- #### Speed Improvements

  Greatly improved the speed of the entire app when switching dashboards or tabs.

- #### Update Home Screen

  Updated tutorial thumbnails on the home Screen.

- #### Widget Charting

  Fixed a few widgets not showing the charting option.

- #### Backwards Compatibility for Widgets / Templates

  Added backwards compatibility if we change widget design or size to have a minimum height and width.

- #### Doc changes

  Added better examples in the docs for the Data Connector Page on how to add single widgets and Snowflake / SQL.

- #### Add support for .jpeg file extensions in OpenBB Copilot

  We previously only supported .jpg and .png image file extensions when uploading images to Copilot. We now also support .jpeg.

- #### Improved vision capability for OpenBB Copilot

  OpenBB Copilot should now give more descriptive, in-depth answers when querying user-uploaded images. Response times have also been improved.

- #### Improved PDF support for OpenBB Copilot

  OpenBB Copilot can now robustly handle a wider range of PDFs.

- #### Fix issue with duplicated document uploads to OpenBB Copilot

  In some rare instances, OpenBB Copilot would duplicate user-uploaded documents, leading to suboptimal answers. This has been fixed.

## Version 0.3.5b - April 9th, 2024

### New Features

- #### New Login and Registration Design

  Updated our Login and added Registration to our app (no more waitlist)

### Bug Fixes and Improvements

- #### Optimized data fetching for news

  We made some updates to have the news articles and associated data load faster.

- #### Listed widgets

  Fixed an issue where widgets were listed in the Data Connector tab that shouldn't have been.

- #### Earnings Transcript

  Fixed an issue on earnings transcripts where we didn't select the most recent year and quarter.

## Version 0.3.4b - April 3rd, 2024

### New Features

- #### Backend Connector

  Native Backend Connector will now support SQLite and has more robust error notifications when building queries.

---

- #### Templates Tab

  Added a new tab "Templates" to get you started quicker with our Excel Add-in. Try it out by simply downloading our predefined templates.

### Bug Fixes and Improvements

- #### Fixed Navigation Bar Delete

  Fixed an issue where you couldn't delete a single tab on the navigation bar widget without removing the whole dashboard.

- #### Fixed "copy to"

  Some folders and dashboards were showing that were deleted in the dropdown, we've filtered those out now.

- #### Advanced Backend Widget

  Fixed an issue where you could only pass a single parameter in the options.

- #### Timezones

  Had a few bugs related to the wrong timezone being applied. This affected some charts and a few news categories.

- #### Financial Statements Widget

  Fixed an issue when transposing the widget would display empty columns.

- #### Autocomplete on Copilot

  Fixed a rendering issue when autocomplete text would go outside of the input box.

- #### Save As Rendering and Pagination on Data Connector

  The Native Data Connector would crash on a "Save As" and re-render if you saved, we've fixed that now. We also
  adjusted the pagination to work correctly.

## Version 0.3.3b - March 26th, 2024

### New Features

- #### OpenBB Copilot now supports image files as uploadable file types

  We've added PNG and JPG images as uploadable files to Copilot, as if they were documents. This allows you to you to upload screenshots of charts, graphs, or tables, and then use these images as context when prompting OpenBB Copilot.

### Bug Fixes and Improvements

- #### Fixes to Charting

  The Charting page will now better remember your symbol choices, and you can save your templates to use across the platform.

- #### News Page

  We've updated the appearance of the News Page and have removed images, allowing more articles to be displayed at once.

- #### Charting from Widget

  Made some minor improvements to the selection of data when creating a chart

- #### Various dark/light mode fixes

  We've fixed some minor visual issues for across both the light and dark mode themes.

- #### Blurry Widgets

  Fixed a bug that would cause some widgets' text to appear blurry

- #### RSS feed

  When adding an RSS Feed, if the URL had a redirect, this would previously result in an error. That issue has now been fixed.

- #### Zero to Hero

  We are now saving your progress in the cloud, previously this was only locally.

- #### News page articles as context for OpenBB Copilot

  The news page and news widgets can now be used with OpenBB Copilot.

- #### Improved citations for OpenBB Copilot

  We've tweaked how OpenBB Copilot provides citations, making them slightly more reliable.

- #### Smoother text streaming for OpenBB Copilot

  We have made the text streaming of OpenBB Copilot's answers slightly smoother.

## Version 0.3.2b - March 14th, 2024

### New Features

- #### RSS News Feed Widget

  We've enhanced our RSS Feed Widget to include some feeds by default and also added it to the News page as a base widget.

---

- #### Earnings Transcript

  You can now create a widget easily from an earnings transcript to use in Copilot and group them with other widgets.

---

- #### Charting

  Charting will now work to save the layout across tabs and you can save new layouts.

### Bug Fixes and Improvements

- #### OpenBB Copilot Enhancements

  - We've added prompt autocompletion suggestions to help you easily re-use prompts you've used before: once you see a suggestion, you can hit TAB to use the completion in the dialog box.
  - We've also improved citations, which now show additional metadata if data from a widget was used to answer your query.
  - There is also now a dedicated "reset chat" button that resets your current chat entirely, removing both uploaded documents and selected widgets.
  - You can now copy OpenBB Copilot's completions. Mouse over a completion and click on an icon to copy the completion to your clipboard.
  - We've also included a few miscellaneous cosmetic improvements.

- #### Performance Improvements

  We've overhauled many important components and this has given us a large performance boost. Rendering and state management have been improved across all widgets resulting in a much more "snappy" feeling when navigating and using the app.

- #### Earnings Transcript Timezone

  Earnings transcripts were showing no results found if the users timezone was 1 day ahead or behind - this shouldn't happen anymore.

- #### Watchlist Fix

  Fixed a bug that wouldn't allow users to change the watchlist ticker and would remove tickers if resized.

- #### Converting Year Drop downs

  Previously they were checkboxes - now its all radio as it was only single select anyways.

- #### Copilot

  Fixed a bug where copilot would return an error if a widget didn't have a description associated with it.

- #### Grouping

  Fixed an issue where more than ten groups on a dashboard caused it to lag.

- #### Visual

  Fixed a visual bug related to long names on Copilot.

## Version 0.3.1b - March 1st, 2024

### Bug Fixes and Improvements

- #### Fixed news and News Page making too many calls

  We noticed the news widgets and news page was calling our provider too many times. We've now made it smarter.

- #### Enhanced Copilot Help

  Added a helpful message to deploy your own Copilot when you click on "Add custom copilot" from the copilot chat

- #### Fixed Grouping bug

  Groups could get the same color if one was deleted before assigning.

- #### Saving Dashboard

  Saving dashboard is now Ctrl - Shift - S to not conflict with other shortcuts (previously it was just Shift - S)

- #### Updated our shortcuts menu

  Check out the shortcuts with Ctrl - H (Cmd - H for Mac)

- #### Filtering by date

  Fixed a bug where you couldn't filter by date on any table widget.

## Version 0.3.0b - February 27th, 2024

### New Features

- #### Interactive Tutorials

  To help you get up to speed with our platform, we've rolled out a new set of interactive tutorials. These guides cover everything from charting basics to researching groups of companies, ensuring you can navigate and utilize OpenBB with confidence.

---

- #### OpenBB Copilot

Meet your new assistant, the OpenBB Copilot!  It's like having a financial analyst at your fingertips, ready to dissect and deliver insights from the vast sea of data at your disposal. Here's how it enhances your experience:

- **Insightful Queries** Pose any question and receive in-depth insights leveraging the entirety of data within your current dashboard.
- **Customized Focus** Tailor its focus by adding one or multiple widgets into its context. This means you get answers that are not only accurate but also relevant to your immediate needs.
- **Custom Dataset Upload** Import your own datasets into the Copilot's context. We support a wide range of file formats including TXT, PDF, CSV, and XLSX, broadening the scope of your analysis.
- **Source Transparency**: With every insight, the Copilot provides detailed citations, pinpointing the exact source of data, down to the widget and document page number, for full transparency and trust.

### Bug Fixes and Improvements

- #### Optimized Widget Grouping

  We've resolved an issue ensuring widgets are correctly grouped by asset classes.

- #### Enhanced News Page

  We fixed a bug where Big Stories articles were not displaying properly.

- #### Persistent Widget Settings

  Widgets now retain their column positions and parameter settings as you navigate across pages, streamlining your workflow.

- #### Financial Statements Widget Enhancement

  The default view for financial statements has been optimized to display the most insightful chart as default.

- #### Price Target Widget Redesign

  The Price Target by Analyst widget has been revamped, offering a new design and expanded data set, including analyst track records, for more informed decision-making.

- #### Performance and Storage Optimization

  We've implemented storage and performance optimizations for dashboards, resulting in faster load times and more efficient data management.

- #### Automatic Dashboard Saves

  Dashboards now auto-save upon page exit, coupled with reduced auto-save intervals, ensuring your work is preserved promptly and efficiently.

- #### Admin Page Improvements

  Enhancements to the Admin page facilitate smoother management of organizational settings and permissions.

- #### Dynamic Search Capabilities

  The search functionality has been expanded to include a wider array of data fields, allowing for more precise and flexible widget discovery.

### Breaking Changes

#### Advanced Data Connectors

- If you have previously added any Advanced Data Connectors to your dashboard, we kindly ask that you re-add these connectors for them to function correctly post-update. We appreciate your understanding as we improve your OpenBB experience. For assistance, our support team is here to help.
