# @pdfme/cli — Specification

**Version**: 0.1.0 (draft)
**Status**: Design specification — not yet implemented

## 1. Overview

`@pdfme/cli` is an agent-native CLI tool for generating PDFs from JSON templates and input data. It follows the [AXI (Agent eXperience Interface)](https://github.com/kunchenguid/axi) design principles, optimizing for token efficiency and autonomous agent workflows.

The CLI is distributed as an npm package with a `pdfme` binary. A companion **skill** (`SKILL.md`) teaches AI agents how to author template JSON and use the CLI effectively.

### Goals

- Let AI agents generate PDFs in 1-2 turns (template + generate)
- Token-efficient output using TOON format
- Zero-config for common cases (built-in plugins, default font)
- Full coverage of pdfme's generation capabilities

### Non-Goals

- Interactive template design (use `@pdfme/ui` Designer for that)
- PDF viewing or rendering
- PDF manipulation (merge/split — use `@pdfme/manipulator`)

## 2. Package Structure

```
packages/cli/
  src/
    index.ts              # Entry point: parse args, dispatch commands
    commands/
      home.ts             # No-args dashboard (AXI principle 8)
      generate.ts         # Core: template + inputs → PDF
      validate.ts         # Validate template JSON
      inspect.ts          # Show template field summary
    plugins.ts            # Load and register all built-in plugins
    fonts.ts              # Font discovery and loading
    output.ts             # TOON formatting helpers
  package.json
  tsconfig.json
  SKILL.md                # Agent skill (see Section 9)
```

### package.json

```json
{
  "name": "@pdfme/cli",
  "version": "0.1.0",
  "bin": { "pdfme": "./dist/index.js" },
  "type": "module",
  "engines": { "node": ">=20" },
  "dependencies": {
    "@pdfme/common": "*",
    "@pdfme/generator": "*",
    "@pdfme/schemas": "*",
    "axi-sdk-js": "^0.1.4"
  }
}
```

No other runtime dependencies. The `axi-sdk-js` package provides CLI routing, TOON output via `@toon-format/toon`, error handling, and session hook installation.

## 3. Commands

### 3.1 `pdfme` (home — no arguments)

**AXI principles**: Content first (8), Ambient context (7), Contextual disclosure (9), Consistent help (10)

Scans the current working directory for `*.template.json` and font files (`.ttf`, `.otf`), then displays a compact dashboard.

**Output**:
```
bin: ~/.npm/bin/pdfme
description: Generate PDFs from JSON templates and input data
templates[2]{file,pages,fields}:
  invoice.template.json,2,7
  label.template.json,1,3
fonts[1]{file,name}:
  NotoSansJP.ttf,NotoSansJP
help[2]:
  Run `pdfme generate <template> <inputs> <output>` to generate a PDF
  Run `pdfme inspect <template>` to see field details
```

**When no templates found**:
```
bin: ~/.npm/bin/pdfme
description: Generate PDFs from JSON templates and input data
templates: 0 template files found (looking for *.template.json)
help[2]:
  Run `pdfme generate template.json inputs.json output.pdf` to generate a PDF
  Create a template: see `pdfme generate --help` for the template format
```

**Rules**:
- Scan only the current directory (not recursive)
- Convention: template files use `*.template.json` suffix
- Also accept `*.json` files that parse as valid pdfme templates
- Font scan looks for `.ttf` and `.otf` files in cwd
- Collapse home directory to `~` in the `bin:` line

### 3.2 `pdfme generate`

**Core command**. Takes a template, input data, and output path. Produces a PDF file.

**Usage**:
```
pdfme generate <template> <inputs> <output> [flags]
```

**Positional arguments**:

| Arg | Description |
|---|---|
| `<template>` | Path to template JSON file |
| `<inputs>` | Path to inputs JSON file or CSV file |
| `<output>` | Output PDF file path, or directory for batch mode |

**Flags**:

| Flag | Type | Default | Description |
|---|---|---|---|
| `--font <path>` | string (repeatable) | none | Path to `.ttf` or `.otf` font file. First font is fallback. |
| `--font-dir <path>` | string | none | Directory of font files to load |
| `--title <str>` | string | none | PDF metadata: title |
| `--author <str>` | string | none | PDF metadata: author |
| `--subject <str>` | string | none | PDF metadata: subject |
| `--creator <str>` | string | none | PDF metadata: creator |
| `--keywords <csv>` | string | none | PDF metadata: comma-separated keywords |
| `--lang <code>` | string | none | Language hint: en, zh, ja, ko, ar, th, pl, it, de, es, fr |
| `--color-type <type>` | string | rgb | Color model: `rgb` or `cmyk` |
| `--base-pdf <path>` | string | none | Override template's basePdf with this PDF file |

**Single input mode** — inputs JSON is an array with one object:
```bash
pdfme generate invoice.template.json data.json invoice.pdf
```
```
result{file,pages,size}:
  invoice.pdf,3,42KB
```

**Batch mode** — inputs JSON has multiple objects, output is a directory:
```bash
pdfme generate label.template.json batch.json ./output/
```
```
result{files,total_pages,total_size}:
  12,36,504KB
next: Run `ls ./output/` to see generated files
```

Batch file naming: `<output_dir>/<index>.pdf` (1-indexed: `1.pdf`, `2.pdf`, ...).

**CSV input mode** — when inputs path ends in `.csv`:
```bash
pdfme generate invoice.template.json records.csv ./output/
```
- Header row maps to field names
- Each subsequent row becomes one input object
- Empty cells become empty strings
- Always produces one PDF per row (batch mode)

**Success output** (TOON):
```
result{file,pages,size}:
  invoice.pdf,2,38KB
```

**Error output** (TOON, exit code 1):
```
error: Font "NotoSansJP" referenced in template but not loaded
help: Run `pdfme generate template.json inputs.json out.pdf --font NotoSansJP.ttf`
```

**Rules**:
- All built-in plugins are registered automatically (text, image, table, barcodes, shapes, date/time, select, checkbox, radioGroup, multiVariableText, svg)
- If no `--font` is provided, uses the built-in Roboto font as fallback
- If `--font` is provided, the first font listed becomes the fallback font
- Template `basePdf` resolution:
  - If `basePdf` is an object (BlankPdf): use as-is
  - If `basePdf` is a string starting with `data:`: treat as base64
  - If `basePdf` is a string that looks like a file path: read from disk relative to template file location
- Output directory is created if it doesn't exist
- Overwrite existing files without prompting (AXI principle 6: no interactive prompts)
- File size in output is human-readable (KB, MB)

### 3.3 `pdfme validate`

Validates a template JSON file against pdfme's schema without generating a PDF.

**Usage**:
```
pdfme validate <template>
```

**Valid template**:
```
template{pages,fields,errors}:
  2,7,0
next: Run `pdfme generate invoice.template.json inputs.json output.pdf`
```

**Invalid template** (exit code 1):
```
template{pages,fields,errors}:
  2,7,3
errors[3]{field,message}:
  "","basePdf.width must be a positive number"
  items,"Unknown schema type: tabel (did you mean: table?)"
  logo,"position.x is required"
help: Fix errors and run `pdfme validate invoice.template.json` again
```

**Rules**:
- Uses pdfme's Zod schema validation (`checkTemplate`)
- Also validates that all schema `type` values match known plugin types
- Suggest typo corrections for unknown types (Levenshtein distance <= 2)
- Count only errors, not warnings
- Exit code 0 if valid, 1 if invalid

### 3.4 `pdfme inspect`

Shows the fields defined in a template, their types, and whether they're required. This is the agent's way to understand what inputs a template expects.

**Usage**:
```
pdfme inspect <template> [--full]
```

**Output**:
```
basePdf: blank A4 (210x297mm, padding 10/10/10/10)
pages: 2
fields[7]{name,type,page,required,size}:
  company_name,text,1,no,100x10
  logo,image,1,no,40x40
  invoice_number,text,1,yes,60x10
  date,date,1,no,50x10
  items,table,1,yes,190x20
  subtotal,text,2,no,50x10
  total,text,2,yes,50x10
next: Run `pdfme generate invoice.template.json inputs.json output.pdf`
```

**With `--full`** — includes additional schema properties per field:
```
basePdf: blank A4 (210x297mm, padding 10/10/10/10)
pages: 2
fields[7]{name,type,page,required,position,size,properties}:
  company_name,text,1,no,20/20,100x10,"fontSize:18 fontColor:#333333 alignment:left"
  logo,image,1,no,160/20,40x40,""
  invoice_number,text,1,yes,20/40,60x10,"fontSize:13 fontColor:#000000"
  date,date,1,no,140/40,50x10,"format:yyyy-MM-dd"
  items,table,1,yes,10/60,190x20,"showHead:true head:Name|Qty|Price|Total"
  subtotal,text,2,no,140/20,50x10,"fontSize:13 alignment:right"
  total,text,2,yes,140/35,50x10,"fontSize:18 fontColor:#000000 alignment:right"
next: Run `pdfme generate invoice.template.json inputs.json output.pdf`
```

**Rules**:
- `page` is 1-indexed
- `size` format: `{width}x{height}` in mm
- `position` format (--full only): `{x}/{y}` in mm
- `properties` (--full only): key:value pairs of non-default extra properties, space-separated
- `required` shows "yes" if schema has `required: true`, otherwise "no"
- If basePdf is a custom PDF file/base64, show `basePdf: custom PDF` instead of dimensions
- Truncate properties to 80 chars in --full mode, append `...` if truncated

### 3.5 `--help` (per-command)

**AXI principle 10**: Every subcommand supports `--help`.

```
pdfme generate --help
```
```
pdfme generate <template> <inputs> <output> [flags]

Generate a PDF from a template and input data.

Arguments:
  template   Path to template JSON file (*.template.json)
  inputs     Path to inputs JSON or CSV file
  output     Output PDF file path, or directory for batch

Flags:
  --font <path>        Font file (.ttf/.otf), repeatable. First is fallback.
  --font-dir <path>    Directory of font files to load
  --title <str>        PDF title metadata
  --author <str>       PDF author metadata
  --subject <str>      PDF subject metadata
  --creator <str>      PDF creator metadata
  --keywords <csv>     PDF keywords (comma-separated)
  --lang <code>        Language: en,zh,ja,ko,ar,th,pl,it,de,es,fr
  --color-type <type>  Color model: rgb (default) or cmyk
  --base-pdf <path>    Override basePdf with this PDF file

Examples:
  pdfme generate invoice.template.json data.json invoice.pdf
  pdfme generate label.template.json batch.csv ./output/
  pdfme generate report.template.json data.json report.pdf --font MyFont.ttf --title "Q4 Report"
```

## 4. Plugin Registration

The CLI automatically registers all built-in `@pdfme/schemas` plugins. The plugin map passed to `generate()` is:

```typescript
import {
  text, multiVariableText, image, svg, table, barcodes,
  line, rectangle, ellipse, dateTime, date, time,
  select, radioGroup, checkbox,
} from '@pdfme/schemas';

const plugins = {
  text,
  multiVariableText,
  image,
  svg,
  table,
  ...barcodes,  // qrcode, japanpost, ean13, ean8, code39, code128, nw7, itf14, upca, upce, gs1datamatrix, pdf417
  line,
  rectangle,
  ellipse,
  dateTime,
  date,
  time,
  select,
  radioGroup,
  checkbox,
};
```

Custom/third-party plugins are **not** supported in v0.1. This keeps the CLI simple and predictable. If a template references an unknown `type`, the CLI errors with a suggestion.

## 5. Font Handling

### Resolution Order

1. Fonts specified via `--font` flags (first one is fallback)
2. Fonts found via `--font-dir` directory scan
3. Built-in Roboto font from `@pdfme/common` (always available as final fallback)

### Font Name Derivation

The font name used in templates is derived from the filename without extension:
- `NotoSansJP-Regular.ttf` → font name `NotoSansJP-Regular`
- `Roboto.ttf` → font name `Roboto`

### Font Loading

Fonts are read from disk as `Uint8Array` and passed to `generate()` via the `options.font` object:

```typescript
const font: Font = {
  'NotoSansJP-Regular': {
    data: fs.readFileSync('NotoSansJP-Regular.ttf'),
    fallback: true,  // first --font flag
    subset: true,
  },
  'Roboto': {
    data: DEFAULT_FONT_VALUE,  // from @pdfme/common
    fallback: false,           // fallback only if no --font provided
    subset: true,
  },
};
```

### Error Cases

- Font file doesn't exist → error with path shown
- Font file isn't valid TTF/OTF → error with filename
- Template references a `fontName` not in the loaded fonts → error listing available fonts

## 6. Input Handling

### JSON Inputs

The inputs file must be a JSON array of objects. Each object maps field names to values:

```json
[
  {
    "company_name": "Acme Corp",
    "invoice_number": "INV-001",
    "items": "[[\\"Widget\\",\\"10\\",\\"$5\\",\\"$50\\"],[\\"Gadget\\",\\"3\\",\\"$15\\",\\"$45\\"]]",
    "total": "$95"
  }
]
```

### CSV Inputs

When the inputs path ends in `.csv`:

```csv
company_name,invoice_number,total
Acme Corp,INV-001,$95
Beta Inc,INV-002,$120
```

**Parsing rules**:
- First row is header (field names)
- Subsequent rows are input objects
- Standard CSV escaping (RFC 4180): quoted fields for commas, newlines, quotes
- Empty cells become empty strings `""`
- No type coercion — all values are strings (same as form input)

### Batch vs Single

- **Single mode**: inputs array has 1 element, `<output>` is a file path → produces one PDF
- **Batch mode**: inputs array has >1 element, `<output>` is a directory → produces N PDFs
- If inputs has >1 element but output is a file path (not directory) → error:
  ```
  error: Multiple inputs require a directory as output path
  help: Run `pdfme generate template.json inputs.json ./output/`
  ```

## 7. Error Handling

**AXI principle 6**: Structured errors on stdout, exit codes, no interactive prompts.

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success (including no-ops) |
| 1 | Runtime error (generation failure, font error, I/O error) |
| 2 | Usage error (missing arguments, invalid flags) |

### Error Format

All errors are written to **stdout** in TOON format so agents can parse them:

```
error: <message>
help: <actionable suggestion using pdfme commands>
```

### Error Categories

**Usage errors** (exit 2):
```
error: Missing required argument: <inputs>
help: pdfme generate <template> <inputs> <output>
```

**Template errors** (exit 1):
```
error: Invalid template: schemas[0][2].position.x must be a number
help: Run `pdfme validate template.json` to see all errors
```

**Font errors** (exit 1):
```
error: Font "CustomFont" referenced in schema "title" but not loaded
help: Run `pdfme generate template.json inputs.json out.pdf --font CustomFont.ttf`
```

**Input errors** (exit 1):
```
error: Required field "invoice_number" missing in inputs[0]
help: Add "invoice_number" to your inputs JSON
```

**I/O errors** (exit 1):
```
error: Cannot read file: ./missing.json (ENOENT)
```

### Rules

- Never leak internal stack traces or dependency error messages
- Always include an actionable `help:` line referencing pdfme commands
- Never prompt for missing values — fail immediately
- Errors go to stdout (not stderr) for agent consumption
- stderr is reserved for debug logging only (if `--debug` flag is added later)

## 8. Session Hooks (Ambient Context)

**AXI principle 7**: Self-install into agent session lifecycle.

On first invocation, the CLI installs a session-start hook into Claude Code and Codex configurations using `axi-sdk-js`'s hook system.

### Hook Behavior

At session start, the hook runs `pdfme` (no args) and outputs the home dashboard. The agent sees available templates and fonts before taking any action.

### Installation

- **Claude Code**: Adds to `~/.claude/settings.json` under `hooks.SessionStart`
- **Codex**: Adds to `~/.codex/hooks.json` and enables `codex_hooks` in config

### Rules

- Uses absolute path to the `pdfme` binary (via `process.execPath` resolution)
- Idempotent: repeated installs are silent no-ops
- Self-healing: updates path if binary location changes
- Scoped to cwd: only shows templates in the current directory
- Token-budget-aware: home output is kept minimal

## 9. Skill Definition (SKILL.md)

The skill is a markdown file that gets installed into AI agents via `npx skills add pdfme/pdfme`. It teaches the agent how to create template JSON files and use the CLI.

### Installation

```bash
npx skills add pdfme/pdfme
```

This copies `SKILL.md` into the agent's skill directory (e.g., `.claude/skills/pdfme/SKILL.md` for Claude Code).

### Skill Content Structure

```
---
name: pdfme
description: >
  Generate PDFs from JSON templates using the pdfme CLI.
  Use when the user asks to create, generate, or design PDFs from data.
---
```

The skill body covers these sections:

#### 9.1 When to Use

Trigger conditions for the agent:
- User asks to generate a PDF (invoice, report, certificate, label, receipt, etc.)
- User has structured data (JSON, CSV, database records) that needs to become a PDF
- User wants to create a reusable PDF template
- User asks about PDF layout, positioning, or formatting

#### 9.2 Template Authoring Reference

Complete reference for creating template JSON, covering:

**Base PDF options**:
- Blank page with dimensions: `{ "width": 210, "height": 297, "padding": [10, 10, 10, 10] }`
- Common sizes: A4 (210x297), Letter (216x279), A5 (148x210), custom
- Existing PDF as base: `"./letterhead.pdf"` (path relative to template file)

**Schema (field) definition** — all measurements in mm:
```json
{
  "name": "field_name",
  "type": "text",
  "position": { "x": 20, "y": 30 },
  "width": 100,
  "height": 10
}
```

**Complete field type reference with all properties and defaults**:

| Type | Key Properties | Defaults |
|---|---|---|
| `text` | fontSize, fontColor, fontName, alignment, verticalAlignment, lineHeight, characterSpacing, backgroundColor, strikethrough, underline, dynamicFontSize | fontSize:13, fontColor:#000000, alignment:left, verticalAlignment:top, lineHeight:1, characterSpacing:0 |
| `multiVariableText` | Same as text + `text` (template string with `{varName}` placeholders), `variables` | Same as text |
| `image` | (content is base64 data URI or file path) | width:40, height:40 |
| `svg` | (content is SVG string) | — |
| `table` | showHead, repeatHead, head (array), headWidthPercentages, content (JSON string of 2D array), tableStyles, headStyles, bodyStyles, columnStyles | showHead:true, repeatHead:false, fontSize:13, headBg:#2980ba, headColor:#ffffff |
| `qrcode` | barColor, backgroundColor | barColor:#000000, backgroundColor:#ffffff, width:30, height:30 |
| `code128` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `ean13` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `ean8` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `code39` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `japanpost` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `nw7` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `itf14` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `upca` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `upce` | barColor, backgroundColor, textColor, includetext | includetext:true |
| `gs1datamatrix` | barColor, backgroundColor | barColor:#000000, backgroundColor:#ffffff |
| `pdf417` | barColor, backgroundColor | barColor:#000000, backgroundColor:#ffffff |
| `line` | color | color:#000000, readOnly:true |
| `rectangle` | borderWidth, borderColor, color, radius | borderWidth:1, borderColor:#000000 |
| `ellipse` | borderWidth, borderColor, color | borderWidth:1, borderColor:#000000 |
| `date` | format, fontName, fontSize, fontColor, backgroundColor, locale | format: date-fns format string |
| `time` | format, fontName, fontSize, fontColor, backgroundColor, locale | format: date-fns format string |
| `dateTime` | format, fontName, fontSize, fontColor, backgroundColor, locale | format: date-fns format string |
| `select` | options (string array) + all text properties | options:["option1","option2"] |
| `radioGroup` | group, color | group:"MyGroup", color:#000000 |
| `checkbox` | color | color:#000000, content:"false" |

**Coordinate system**:
- Origin (0,0) is top-left of the page content area (inside padding)
- All values in millimeters
- `position.x` = horizontal offset from left padding edge
- `position.y` = vertical offset from top padding edge

**Multi-page templates**:
- `schemas` is an array of arrays: `schemas[pageIndex][fieldIndex]`
- Each sub-array defines fields for one page
- Each input object provides values for ALL pages (not per-page)

**Read-only fields**:
- Set `"readOnly": true` to use `content` as static/template text
- Supports placeholders: `{fieldName}`, `{totalPages}`, `{currentPage}`

**Required fields**:
- Set `"required": true` to enforce that inputs must provide this field

#### 9.3 Input Data Reference

**JSON format**:
```json
[
  { "field_name": "value", "other_field": "other_value" },
  { "field_name": "value2", "other_field": "other_value2" }
]
```

**Table field content** — JSON string encoding a 2D array (rows of cells):
```json
{
  "items": "[[\"Widget\",\"10\",\"$5.00\",\"$50.00\"],[\"Gadget\",\"3\",\"$15.00\",\"$45.00\"]]"
}
```

**Image field content** — base64 data URI:
```json
{
  "logo": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Checkbox/radioGroup content** — string `"true"` or `"false"`:
```json
{
  "agree_terms": "true"
}
```

#### 9.4 Workflow

Step-by-step instructions for the agent:

1. **Understand requirements** — what content, what layout, what page size
2. **Create template JSON** — define basePdf and schemas with field positions
3. **Create inputs JSON** — map field names to values
4. **Validate** (optional) — `pdfme validate template.json`
5. **Generate** — `pdfme generate template.json inputs.json output.pdf`
6. **Iterate** — adjust positions/sizes based on output

#### 9.5 Complete Examples

Three full working examples the agent can use as starting points:

**Example 1: Simple Invoice**
```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [10, 10, 10, 10] },
  "schemas": [[
    { "name": "company", "type": "text", "position": { "x": 0, "y": 0 }, "width": 100, "height": 12, "fontSize": 20, "fontColor": "#333333" },
    { "name": "invoice_no", "type": "text", "position": { "x": 130, "y": 0 }, "width": 60, "height": 8, "fontSize": 12, "alignment": "right" },
    { "name": "date", "type": "date", "position": { "x": 130, "y": 10 }, "width": 60, "height": 8, "fontSize": 12, "alignment": "right", "format": "yyyy-MM-dd" },
    { "name": "bill_to", "type": "text", "position": { "x": 0, "y": 30 }, "width": 100, "height": 20, "fontSize": 11, "lineHeight": 1.4 },
    { "name": "items", "type": "table", "position": { "x": 0, "y": 60 }, "width": 190, "height": 30, "showHead": true, "head": ["Description", "Qty", "Unit Price", "Total"], "headWidthPercentages": [50, 15, 17.5, 17.5], "content": "[]" },
    { "name": "total", "type": "text", "position": { "x": 130, "y": 100 }, "width": 60, "height": 10, "fontSize": 16, "alignment": "right", "fontColor": "#000000" }
  ]]
}
```

**Example 2: Shipping Label**
```json
{
  "basePdf": { "width": 100, "height": 150, "padding": [5, 5, 5, 5] },
  "schemas": [[
    { "name": "from_name", "type": "text", "position": { "x": 0, "y": 0 }, "width": 90, "height": 6, "fontSize": 8 },
    { "name": "from_address", "type": "text", "position": { "x": 0, "y": 6 }, "width": 90, "height": 12, "fontSize": 8, "lineHeight": 1.3 },
    { "name": "separator", "type": "line", "position": { "x": 0, "y": 22 }, "width": 90, "height": 0.5, "readOnly": true, "color": "#cccccc" },
    { "name": "to_name", "type": "text", "position": { "x": 0, "y": 28 }, "width": 90, "height": 8, "fontSize": 14 },
    { "name": "to_address", "type": "text", "position": { "x": 0, "y": 38 }, "width": 90, "height": 20, "fontSize": 12, "lineHeight": 1.4 },
    { "name": "tracking", "type": "qrcode", "position": { "x": 25, "y": 70 }, "width": 40, "height": 40 },
    { "name": "tracking_text", "type": "code128", "position": { "x": 5, "y": 115 }, "width": 80, "height": 20, "includetext": true }
  ]]
}
```

**Example 3: Certificate**
```json
{
  "basePdf": { "width": 297, "height": 210, "padding": [20, 20, 20, 20] },
  "schemas": [[
    { "name": "border", "type": "rectangle", "position": { "x": 0, "y": 0 }, "width": 257, "height": 170, "borderWidth": 2, "borderColor": "#c49a6c", "color": "", "readOnly": true },
    { "name": "title", "type": "text", "position": { "x": 28.5, "y": 20 }, "width": 200, "height": 15, "fontSize": 28, "alignment": "center", "fontColor": "#333333", "readOnly": true, "content": "Certificate of Completion" },
    { "name": "recipient", "type": "text", "position": { "x": 28.5, "y": 55 }, "width": 200, "height": 14, "fontSize": 24, "alignment": "center", "fontColor": "#1a1a1a" },
    { "name": "description", "type": "text", "position": { "x": 28.5, "y": 80 }, "width": 200, "height": 20, "fontSize": 13, "alignment": "center", "lineHeight": 1.5, "fontColor": "#555555" },
    { "name": "date_line", "type": "line", "position": { "x": 28.5, "y": 130 }, "width": 80, "height": 0.5, "readOnly": true, "color": "#999999" },
    { "name": "issue_date", "type": "date", "position": { "x": 28.5, "y": 132 }, "width": 80, "height": 8, "fontSize": 10, "alignment": "center", "format": "MMMM d, yyyy" },
    { "name": "sig_line", "type": "line", "position": { "x": 148.5, "y": 130 }, "width": 80, "height": 0.5, "readOnly": true, "color": "#999999" },
    { "name": "signatory", "type": "text", "position": { "x": 148.5, "y": 132 }, "width": 80, "height": 8, "fontSize": 10, "alignment": "center" }
  ]]
}
```

#### 9.6 Tips for Agents

Practical guidance:
- Start with A4 blank (`210x297mm`) for documents, custom sizes for labels/cards
- Use `pdfme inspect` to understand existing templates before modifying
- Table content is a JSON string of a 2D array — remember to stringify it
- Position fields top-to-bottom; leave ~2mm gap between fields
- For batch generation, use CSV — one PDF per row
- Always validate before generating to catch errors early
- Font name in schema must exactly match the loaded font name (filename without extension)

## 10. Build and Distribution

### Build

The CLI package compiles TypeScript to ESM (Node.js target):

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "./dist",
    "declaration": true
  }
}
```

The entry point (`dist/index.js`) starts with `#!/usr/bin/env node`.

### Distribution

- Published to npm as `@pdfme/cli`
- Binary name: `pdfme`
- Install: `npm install -g @pdfme/cli`
- The skill is published to the skills registry and also bundled in the package

### Monorepo Integration

- Added to root `package.json` workspaces: `"packages/cli"`
- Build script: `npm run build:cli`
- Build order: after generator and schemas (depends on both)
- Added to root build: `npm run build:schemas && run-p build:generator build:ui build:manipulator build:cli`

## 11. Testing Strategy

### Unit Tests

- Command parsing and flag validation
- Font loading and name derivation
- CSV parsing
- TOON output formatting
- Error message generation
- Template file discovery (home command)

### Integration Tests

- End-to-end: template JSON + inputs JSON → valid PDF file
- Batch mode: multiple inputs → multiple PDFs in directory
- CSV input mode
- Font loading from `--font` flag
- Base PDF override via `--base-pdf`
- Error cases: missing files, invalid templates, missing fonts, missing required inputs

### Test Fixtures

- A set of template JSON files in `__tests__/fixtures/`
- Corresponding input JSON and CSV files
- Expected output verification (file exists, page count, file size > 0)

## 12. Future Considerations (Out of Scope for v0.1)

These are explicitly **not** part of v0.1 but noted for future versions:

- **Custom plugins** via `--plugin <path>` flag (dynamic import of user plugins)
- **Stdin/stdout piping** (`cat data.json | pdfme generate template.json - -` for streaming)
- **Watch mode** (`pdfme generate --watch` for template development)
- **Template scaffolding** (`pdfme init invoice` to create a starter template)
- **PDF metadata extraction** (`pdfme info output.pdf` to inspect generated PDFs)
- **Merge/split** commands wrapping `@pdfme/manipulator`
- **Remote templates** (URLs as template paths)
- **JSON Schema export** (`pdfme schema template.json` → JSON Schema for inputs validation)
