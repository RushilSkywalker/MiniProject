---
name: GraphQuery
description: A light classroom workbench for inspectable graph queries
colors:
  primary: "#226448"
  primary-hover: "#184d36"
  canvas: "#f6f7f4"
  surface: "#ffffff"
  ink: "#172c25"
  muted: "#596b62"
  border: "#dce3dc"
  focus: "#438862"
  field: "#fcfdfb"
  field-border: "#cad6cc"
  code-text: "#c7e8b9"
  demo-surface: "#f0f5e9"
  demo-ink: "#416032"
  demo-border: "#c9d7bc"
  error-surface: "#fbede9"
  error-ink: "#913b29"
  info-surface: "#f8f3e5"
  info-ink: "#765b24"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "36px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 750
    letterSpacing: "-0.025em"
  intro:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 450
  question:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 450
    lineHeight: 1.7
  button:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 650
  label:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 450
    lineHeight: 1.9
rounded:
  small: "5px"
  field: "8px"
  banner: "10px"
  panel: "12px"
  badge: "20px"
spacing:
  space-4: "4px"
  space-8: "8px"
  space-12: "12px"
  space-16: "16px"
  space-20: "20px"
  space-24: "24px"
  space-32: "32px"
  space-48: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "13px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  question-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.question}"
    rounded: "{rounded.field}"
    padding: "14px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  mode-badge:
    backgroundColor: "{colors.demo-surface}"
    textColor: "{colors.demo-ink}"
    rounded: "{rounded.badge}"
    padding: "7px 12px"
---

# Design System: GraphQuery

## Overview

**Creative North Star: "The Classroom Workbench"**

The classroom workbench is a light Operate interface: off-white canvas, white panels, green actions, and quiet separators. Its restrained density keeps questions, generated code, review, and results legible as a single working surface. This description preserves the incumbent direction; it is an implementation decision, not a newly claimed user preference.

Flat surfaces and a compact type hierarchy favor inspection. The dark query panel provides the strongest tonal distinction. Locally bundled Manrope supplies the interface voice; system monospace identifies code and parameter values.

**Key Characteristics:**

- Light canvas with forest-green actions.
- Flat bordered panels and a distinct dark code surface.
- Two columns on desktop; a single reading-order stack on mobile.
- Explicit asynchronous feedback and visible keyboard focus.

## Colors

The palette combines forest green with warm pale neutrals. Frontmatter records the implementation values; names below explain their use.

### Primary

Forest Green (`primary`) identifies the main action, relevant icons, and positive review feedback. Deep Forest (`primary-hover`) provides button hover feedback. Leaf Green (`focus`) is the keyboard outline.

### Neutral

Off-white Canvas (`canvas`) separates white Surface panels (`surface`). Deep Green Ink (`ink`) carries primary text and doubles as the code-panel background. Muted Sage (`muted`) supports descriptions and metadata; Pale Sage Border (`border`) defines panels and dividers. The question field uses the slightly tinted Field surface and Field Border. Pale Code Green (`code-text`) carries generated Cypher.

### State colors

The Demo surface, ink, and border tokens identify the mode badge. Error uses pale red and dark red text; information and clarification use pale amber and brown text. Text and icons communicate these states alongside color.

## Typography

**Display Font:** locally bundled Manrope Variable, sans-serif fallback.  
**Body Font:** the same Manrope family, with an inherited weight of 450.  
**Label/Mono Font:** labels retain Manrope; Cypher and parameters use ui-monospace, SFMono-Regular, Consolas, monospace.

Manrope gives the compact controls a clear, rounded voice. The frontmatter records specific observed roles rather than a universal body-size claim.

### Hierarchy

- **Display:** page title uses the display role, reducing to 31px at the mobile breakpoint.
- **Title:** main form heading uses the title role; output headings and result headings use 13px.
- **Body:** introduction uses the intro role, reducing to 12px on mobile with 1.8 line height. Submitted questions use 16px, weight 650, and 1.7 line height.
- **Input:** question text uses the question role on desktop and 16px at the mobile breakpoint, with 1.7 line height.
- **Label:** visible field labels use the label role. Metadata spans 9–11px; explanatory copy commonly spans 11–12px.
- **Code:** generated Cypher and parameter blocks use the code role and wrap long content.

Small metadata remains a minor readability caveat, especially for projection or low-vision use. The current interface does not implement a blanket 14–16px body scale.

## Layout

The main container has a maximum width of 1450px, centered with 4.5% horizontal padding and 44px top padding. The desktop workspace uses a 350px question column and a flexible evidence column, separated by 24px. At widths up to 1050px, the question column becomes 310px and the gap becomes 18px.

At widths up to 760px, the workspace becomes a single column with a 20px gap. Main padding becomes 32px at the top and 6% horizontally. Questions precede evidence in document order. The process explanation also stacks; footer content wraps. Secondary header and intro details are hidden to retain focus on the workflow.

The spacing tokens capture recurring values, not an exclusive arithmetic scale: component-specific values such as 13px button padding, 14px input padding, and 19px mobile response padding remain part of the implementation. Result tables scroll within their own container; question and code text wrap.

## Elevation & Depth

There are no panel shadows. White panels, tinted support areas, thin borders, and the dark code surface convey separation. Focus is a 3px solid outline with a 4px offset, not a shadow.

## Shapes

Panels use the panel radius; fields, primary buttons, and code containers use the field radius. The demo banner and brand mark use the banner radius, while mode badges use the badge radius. Smaller status and utility elements vary from 4–7px. Circular dots and graph nodes provide compact status and graph motifs.

## Components

### Buttons

Compact and direct. The full-width primary action uses green with white text and a deeper-green hover. Buttons transition background and color over 0.15s. Disabled buttons use 0.5 opacity and a not-allowed cursor. Example actions are full-width text rows with subtle separators, a pale hover, and green hover text. All interactive controls retain the shared focus outline.

### Chips

The mode badge is a noninteractive status label with a small current-color dot. Demo styling uses the documented demo tokens; live styling uses a pale green surface (#edf5f1) and primary text. It is not a filter or selectable chip.

### Cards / Containers

The question and answer panels are white, thin-bordered, rounded, and shadow-free. Form and response padding is generally 24px on desktop. The answer panel has a minimum height of 570px, reducing to 420px on mobile.

### Inputs / Fields

The question textarea has a tinted surface, thin field border, rounded corners, 14px padding, and a minimum height of 134px. It resizes vertically. Its visible label and helper text remain associated with the input. Processing disables editing. Mobile input text is 16px.

### Navigation

The header carries the brand, an in-page explanation link, and a mode badge. Links use underline and primary color on hover. The explanation link is hidden in the mobile header; the explanation remains in the page, and the footer retains a return-to-question link.

### Query evidence

Generated code is the only dark panel, with a compact copy action and an explanation divider. Copy success and failure use polite status feedback; success also changes the button label. Parameters use a disclosure beneath it. Review and result states pair icons with text. The result table has column headings, wrapping cells, and a keyboard-focusable scrolling region. Empty, busy, error, unsupported, clarification, and no-match states have explicit copy. Loading uses a one-second linear spinner; reduced-motion preference disables the spinner animation and transitions.

## Do's and Don'ts

### Do:

- **Do** use the primary green for the main action and positive review cues.
- **Do** retain visible focus rings, labeled inputs, and textual state descriptions.
- **Do** preserve wrapping for code and questions and horizontal scrolling for result tables.
- **Do** keep demo and live labels explicit.

### Don't:

- **Don't** add panel shadows to this flat workbench.
- **Don't** make the whole workspace dark; reserve the dark container treatment for code.
- **Don't** treat the existing small metadata sizes as a general body-text recommendation.
