# AGENTS.md

## Project

This project is a custom Shopify theme for an illustration / digital-art
commerce website.

The primary goal is to reproduce the provided UI references as accurately
as possible using Shopify Liquid, HTML, CSS, JavaScript, and theme assets.

Visual accuracy is a first-class requirement.

The reference design is the source of truth.

---

# 1. Core Objective

When implementing or modifying a UI:

1. Understand the reference design.
2. Inspect the existing Shopify theme structure.
3. Plan the implementation.
4. Implement the UI.
5. Run the application.
6. Validate the result in a real browser using Playwright.
7. Generate screenshots.
8. Compare screenshots against the reference using Pixelmatch.
9. Inspect the visual differences.
10. Fix the implementation.
11. Run visual validation again.
12. Repeat until the visual result passes the acceptance criteria.

Do not consider a UI task complete simply because:

- the page renders,
- there are no console errors,
- the HTML looks correct,
- the CSS looks reasonable,
- or the implementation "looks close".

The implementation must also pass visual validation.

---

# 2. Source of Truth

Reference screenshots are the primary visual source of truth.

Reference files are stored under:

reference/

Example:

reference/
├── desktop.png
├── tablet.png
└── mobile.png

If the reference contains a visual property that is not explicitly described,
infer it from the reference image.

Do not replace the reference design with personal design preferences.

Do not redesign the UI unless explicitly requested.

---

# 3. Visual Fidelity Priority

When comparing the implementation against the reference, prioritize
differences in this order:

1. Overall layout
2. Element position
3. Element dimensions
4. Image size and crop
5. Typography
6. Spacing
7. Alignment
8. Responsive behavior
9. Colors
10. Borders
11. Border radius
12. Shadows
13. Buttons and controls
14. Icons
15. Animations and transitions
16. Minor decorative details

Large structural differences must always be fixed before small cosmetic
differences.

---

# 4. Reference Measurements

For the main desktop reference at 1440x1024:

## Artwork

Approximate:

- x: 236px
- width: 520px
- y: 24px

## Thumbnail Navigation

Approximate:

- x: 93.5px
- y: 258px
- width: 78px
- height: 507px
- gap: approximately 23.5px

## Right Content

Approximate:

- x: 845px
- y: 80px
- width: approximately 529px

These measurements are visual anchors.

Do not blindly hardcode these coordinates.

Use them to understand the intended layout and derive a responsive layout
system.

---

# 5. Responsive Breakpoints

The implementation must work across:

## Small Mobile

320px - 639px

## Tablet

640px - 1023px

## Large

1024px - 1279px

## Extra Large

1280px+

Do not simply scale the desktop layout down.

Determine how the reference design changes between breakpoints.

Pay special attention to:

- stacking
- spacing
- image size
- thumbnail behavior
- navigation
- typography
- button size
- content width
- overflow
- horizontal scrolling
- visibility of elements

---

# 6. Shopify Theme Rules

This project uses:

- Shopify Liquid
- Tailwind CSS
- JavaScript
- Shopify Theme Architecture

Tailwind CSS is the primary styling system.

When implementing UI, prefer Tailwind utility classes directly in Liquid,
sections, snippets, and components.

Example:

liquid
<div class="mx-auto flex max-w-7xl items-center gap-8 px-6">
Do NOT create custom CSS when the same result can reasonably be achieved
with Tailwind utilities.
Avoid duplicated logic.

---

# 7. Implementation Process

For every UI task, follow this process.

## Step 1 — Analyze

Before writing code:

- inspect the relevant theme files
- inspect existing components
- inspect available assets
- inspect the reference screenshots
- identify layout structure
- identify typography
- identify spacing
- identify responsive behavior
- identify animations
- identify interactive behavior

Determine:

- page structure
- major containers
- columns
- image areas
- navigation
- content hierarchy
- buttons
- cards
- responsive transformations

Do not immediately start changing CSS without understanding the structure.

---

# 8. Step 2 — Plan

Create a short implementation plan internally.

Example:

1. Update product gallery structure.
2. Create thumbnail navigation.
3. Implement responsive two-column layout.
4. Match typography.
5. Implement gallery animation.
6. Validate desktop.
7. Validate tablet.
8. Validate mobile.
9. Fix visual differences.

Keep the implementation focused.

Do not modify unrelated files.

---

# 9. Step 3 — Implement

Implement the UI using the existing project architecture.

Prefer reusable classes and components.

Avoid excessive one-off CSS.

Avoid unnecessary absolute positioning.

Use:

- flexbox
- grid
- max-width
- min/max dimensions
- responsive units
- CSS variables
- media queries

when appropriate.

Absolute positioning may be used when the reference genuinely requires it,
but it should not be the default layout strategy.

---

# 10. Step 4 — Run the Application

The Shopify development server should be available at:

http://127.0.0.1:9292

If it is not running, start the appropriate Shopify development server.

Before visual testing, verify that the page is reachable.

Do not assume that the application is running.

---

# 11. Playwright Browser Validation

Playwright is the browser validation layer.

The project uses Chromium for deterministic visual testing.

The screenshot script is:

scripts/visual/screenshot.mjs

Run:

npm run ui:screenshot

The screenshot script should test these viewports:

- Desktop: 1440x1024
- Large Desktop: 1280x900
- Tablet: 768x1024
- Mobile: 390x844

Playwright must wait for:

1. DOM content to load.
2. Fonts to load.
3. Images to load.
4. Required UI initialization.
5. Animations to reach the intended visual state.

Do not use `networkidle` as the primary readiness condition for the Shopify
development server because persistent requests may prevent network idle.

Use:

waitUntil: 'domcontentloaded'

with an appropriate timeout.

---

# 12. Animation Handling

This project contains animations.

The screenshot process should allow animations to load before taking the
screenshot.

The current default animation wait is approximately:

3 seconds

Example:

await page.waitForTimeout(3000);

Do not remove the animation wait unless there is a specific reason.

However, visual validation must remain deterministic.

If an animation continuously loops and causes screenshots to change between
runs, modify the testing strategy so the screenshot is taken at a consistent
visual state.

The goal is not to remove animations from the actual website.

The goal is to make visual testing deterministic.

---

# 13. Screenshot Output

Screenshots must be generated into:

screenshots/

Expected files:

screenshots/
├── desktop.png
├── large-desktop.png
├── tablet.png
└── mobile.png

Do not manually edit screenshots.

Screenshots are generated artifacts.

---

# 14. Pixelmatch Validation

Pixelmatch is the objective visual comparison layer.

The comparison script is:

scripts/visual/compare.mjs

Run:

npm run ui:compare

The full visual test command is:

npm run ui:check

This command should:

1. Generate screenshots.
2. Compare screenshots against reference images.
3. Generate diff images.
4. Generate machine-readable test results.
5. Return a failing exit code when visual validation fails.

---

# 15. Visual Test Output

The comparison process should generate:

diffs/

and:

visual-report/

Expected structure:

diffs/
├── desktop-diff.png
├── large-desktop-diff.png
├── tablet-diff.png
└── mobile-diff.png

visual-report/
└── test-result.json

The JSON result must contain enough information for an AI agent to
understand the validation result.

Example:

{
  "status": "FAIL",
  "threshold": 0.5,
  "results": {
    "desktop": {
      "status": "FAIL",
      "diffPixels": 18432,
      "diffPercentage": 2.31
    },
    "tablet": {
      "status": "PASS",
      "diffPixels": 421,
      "diffPercentage": 0.08
    },
    "mobile": {
      "status": "FAIL",
      "diffPixels": 9231,
      "diffPercentage": 1.74
    }
  }
}

---

# 16. Visual Acceptance Threshold

The default visual difference threshold is:

0.5%

A viewport passes when:

diffPercentage < 0.5%

All required viewports must pass.

Example:

Desktop: 0.31%  -> PASS
Tablet:  0.18%  -> PASS
Mobile:  0.42%  -> PASS

Overall result:

PASS

If any required viewport exceeds the threshold:

Overall result:

FAIL

Do not declare the implementation complete while required viewports are
failing.

---

# 17. Visual Validation Loop

This is the most important workflow in this project.

After implementing a UI, Claude MUST enter the following loop:

IMPLEMENT
    ↓
RUN
    ↓
SCREENSHOT
    ↓
PIXELMATCH
    ↓
READ TEST RESULT
    ↓
INSPECT DIFFERENCES
    ↓
IDENTIFY ROOT CAUSE
    ↓
FIX CODE
    ↓
RUN AGAIN
    ↓
REPEAT
    ↓
PASS
    ↓
DONE

The loop must continue until the visual acceptance criteria are satisfied.

---

# 18. How to Interpret Test Results

After running:

npm run ui:check

immediately inspect:

visual-report/test-result.json

Determine:

- which viewport failed
- diff percentage
- number of different pixels
- whether the difference is large or small
- whether the issue is structural or cosmetic

Then inspect:

1. reference screenshot
2. actual screenshot
3. diff screenshot

Do not blindly modify CSS based only on the percentage.

The percentage tells you that something is wrong.

The screenshots tell you what is wrong.

---

# 19. Root Cause Analysis

When a visual test fails, identify the most likely root cause before editing.

Examples:

If the entire right column is shifted:

Likely causes:

- container width
- grid columns
- gap
- margin
- padding

Do not randomly change:

- font size
- button height
- border radius

If the image is too small:

Check:

- width
- height
- object-fit
- aspect ratio
- container size
- max-width

If text is too low:

Check:

- line-height
- margin
- padding
- font loading
- font size

If mobile layout is wrong:

Check:

- breakpoint
- flex direction
- grid columns
- width constraints
- overflow

Fix the root cause instead of applying random offsets.

---

# 20. Fix Strategy

When multiple differences exist:

Fix the largest visual discrepancy first.

Recommended order:

1. Page/container geometry
2. Main columns
3. Major image dimensions
4. Major element positioning
5. Typography
6. Spacing
7. Controls
8. Decorative details

After each meaningful fix:

Run:

npm run ui:check

Do not make a large collection of unrelated changes before testing again.

---

# 21. Do Not Overfit One Viewport

A fix that improves desktop but breaks mobile is not considered successful.

After changing responsive CSS:

Always validate:

- desktop
- large desktop
- tablet
- mobile

The implementation must be responsive rather than a collection of
viewport-specific hacks.

Do not solve a problem with arbitrary pixel offsets if a proper layout rule
solves the underlying issue.

---

# 22. Browser Inspection

When necessary, use Playwright to inspect:

- viewport
- element bounding boxes
- computed styles
- element dimensions
- visibility
- text
- images
- scroll position
- animations
- console errors

Useful information includes:

- `getBoundingClientRect()`
- computed styles
- element dimensions
- screenshot evidence

Use browser inspection to understand why the implementation differs from the
reference.

---

# 23. Reference vs Actual vs Diff

Always think in three layers:

REFERENCE
The intended design.

ACTUAL
What the browser currently renders.

DIFF
The measurable difference between them.

The objective is:

ACTUAL → REFERENCE

not:

REFERENCE → ACTUAL

Never modify the reference screenshot to make the test pass.

---

# 24. Avoid False Positives

Do not lower the Pixelmatch threshold simply because the implementation
currently fails.

Do not modify the reference image.

Do not ignore a failing viewport.

Do not remove visual validation.

Do not mark tests as passing manually.

If the comparison is unstable because of:

- animation
- font loading
- image loading
- dynamic content
- timestamps
- random content

make the test deterministic instead.

---

# 25. Dynamic Content

If the UI contains dynamic content, use stable test data where possible.

Do not allow random or changing content to cause false visual failures.

Examples:

- random IDs
- timestamps
- rotating content
- random images
- changing counters

Visual tests should compare the same logical UI state.

---

# 26. Console and Runtime Errors

Visual validation does not replace functional validation.

When using Playwright, also watch for:

- JavaScript errors
- failed requests
- missing images
- missing fonts
- Liquid rendering errors
- broken interactions

A visually similar page with broken functionality is not considered complete.

---

# 27. Claude Autonomous Workflow

When asked to implement or fix a UI, Claude should operate autonomously.

The expected behavior is:

1. Inspect the relevant files.
2. Inspect reference images.
3. Implement the UI.
4. Run the application if necessary.
5. Run:

   npm run ui:check

6. Read:

   visual-report/test-result.json

7. Inspect generated screenshots and diff images.
8. Determine the largest visual discrepancy.
9. Identify its root cause.
10. Modify the relevant code.
11. Run:

   npm run ui:check

12. Repeat the process.

Claude should continue this loop without asking the user to manually run the
visual test after every change.

Only stop and ask the user for help when there is an actual blocker, such as:

- application cannot start
- reference image is missing
- required asset is missing
- Shopify configuration is unavailable
- browser cannot launch
- test infrastructure is broken
- the expected design cannot be determined from the available references

---

# 28. Maximum Iteration Safety

Do not enter an infinite loop.

Use a maximum of approximately:

10 visual iterations per task

If the UI still fails after 10 iterations:

1. Stop.
2. Summarize the remaining visual differences.
3. Identify the likely blockers.
4. Explain what has already been attempted.
5. Ask for human direction only if necessary.

Do not artificially declare PASS.

---

# 29. Completion Criteria

A UI task is complete only when:

- the page renders successfully
- required functionality works
- no critical runtime errors exist
- screenshots have been generated
- Pixelmatch validation has been executed
- all required viewports pass the visual threshold
- responsive behavior is acceptable
- animations are handled consistently
- no obvious visual mismatch remains

The final validation command should be:

npm run ui:check

The final result must be:

PASS

---

# 30. Final Response

When the task is complete, provide a concise summary:

- what was implemented
- important files changed
- visual validation result
- tested viewports
- any remaining known limitations

Example:

Implemented the illustration product page.

Changes:
- Updated product gallery.
- Added responsive thumbnail navigation.
- Matched desktop and mobile layouts.
- Updated typography and spacing.
- Added gallery animation handling.

Visual validation:
- Desktop: PASS
- Large Desktop: PASS
- Tablet: PASS
- Mobile: PASS

Overall: PASS

---

# 31. Important Rules

Never:

- modify reference screenshots
- fake test results
- ignore failed visual tests
- lower thresholds just to obtain PASS
- remove animations from production solely to make tests pass
- overfit desktop while breaking mobile
- make unrelated changes
- blindly add arbitrary pixel offsets
- declare completion without running visual validation

Always:

- use the reference as the source of truth
- validate with a real browser
- use Playwright for browser validation
- use Pixelmatch for objective comparison
- inspect the actual visual differences
- fix root causes
- validate all viewports
- repeat until PASS