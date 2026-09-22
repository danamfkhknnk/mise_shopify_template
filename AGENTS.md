# AGENTS.md

## Shopify Theme Development

- Follow Shopify Liquid theme architecture and best practices.
- When working with Shopify Liquid themes, call `learn_shopify_api` once.
- Use Shopify AI Toolkit for Shopify API/platform work.
- Prefer reusable, modular components over large monolithic sections.
- Keep implementation clear and consistent rather than clever.

## Theme Color Palette

Use this palette as the default theme palette. Reference images do not override it.

| Role | Color |
|---|---|
| Background | `#F0F0F0` |
| Primary / accent | `#FE5E0F` |
| Secondary / muted | `#6B6B6B` |
| Foreground / text / border | `#111111` |
| Card / surface | `#FFFFFF` |
| Text on dark | `#FFFFFF` |

## Shopify Theme Structure

```text
assets/      CSS, JavaScript, images, fonts
blocks/      Reusable and nestable theme blocks
config/      Global theme settings
layout/      Global HTML document wrapper
locales/     Translation files
sections/    Modular page sections
snippets/    Reusable Liquid/HTML fragments
templates/   Page composition and section ordering
```

### Component Responsibilities

**Layout**
- Owns the global HTML document structure.
- Must include `{{ content_for_header }}` and `{{ content_for_layout }}`.

**Templates**
- Define page composition and the order of sections.
- Use templates to compose pages from independent sections.

**Sections**
- Large page-level modules such as Hero, About, Services, Portfolio, FAQ, Contact.
- Can contain blocks.
- Use `{% schema %}` when Theme Editor configuration is required.

**Blocks**
- Smaller, repeatable, customizable components inside sections.
- Can be added, removed, reordered, and nested.
- Use `{% schema %}`.

**Snippets**
- Reusable Liquid/HTML implementation details.
- Render with `{% render 'snippet-name' %}`.
- Not directly configurable as Theme Editor components.
- Use `{% doc %}` / LiquidDoc for reusable snippets.

Recommended hierarchy:

```text
layout
  ↓
template
  ↓
section
  ↓
block
  ↓
snippet
```

Do not try to put an entire page into one huge section. Split major page areas into independent sections.

## Section Groups and Nested Content

Use section groups when multiple sections need to be rendered together as part of a layout:

```liquid
{% sections 'group-name' %}
```

Use blocks for nested, reorderable content inside a section:

```liquid
{% content_for 'blocks' %}
```

Use a single static block when appropriate:

```liquid
{% content_for 'block', type: 'slide', id: 'slide-1' %}
```

Static section rendering uses:

```liquid
{% section 'section-name' %}
```

## Liquid Syntax

Output:

```liquid
{{ value }}
```

Output with whitespace trimming:

```liquid
{{- value -}}
```

Logic:

```liquid
{% if condition %}
{% endif %}
```

Logic with whitespace trimming:

```liquid
{%- if condition -%}
{%- endif -%}
```

Liquid does not support parentheses or ternary operators in conditions. Use nested logic instead.

Useful tags include:

- `assign`
- `capture`
- `if`
- `elsif`
- `unless`
- `case`
- `for`
- `paginate`
- `render`
- `content_for`
- `section`
- `sections`
- `style`
- `stylesheet`
- `javascript`
- `liquid`
- `doc`
- `form`
- `break`
- `continue`
- `cycle`
- `increment`
- `decrement`
- `comment`
- `raw`
- `echo`

### Variables

Use `assign` for variables:

```liquid
{% assign variable_name = value %}
```

Avoid variable names that override predefined Shopify Liquid objects.

### Loops

A `for` loop supports a maximum of 50 iterations per page.

For supported arrays containing more items, use `paginate`:

```liquid
{% paginate array by page_size %}
  {% for item in array %}
    ...
  {% endfor %}
{% endpaginate %}
```

Pagination supports the arrays documented by Shopify, including products, collections, articles, comments, customer orders/addresses, search results, variants, and supported list settings.

### Render

Pass variables explicitly to snippets:

```liquid
{% render 'filename', image: product.featured_image %}
```

Variables created outside a snippet are not directly available inside it unless passed as parameters. Global/directly accessible objects remain available according to Shopify's Liquid scope rules.

## CSS and JavaScript

Prefer component-local `{% stylesheet %}` and `{% javascript %}` tags for section, block, and snippet styles/scripts.

Each section, block, or snippet can contain only one `{% stylesheet %}` tag and one `{% javascript %}` tag.

Example:

```liquid
{% stylesheet %}
  .component {
    display: block;
  }
{% endstylesheet %}
```

```liquid
{% javascript %}
  // JavaScript
{% endjavascript %}
```

Do not put Liquid code inside `{% stylesheet %}` or `{% javascript %}` tags.

Use `assets/` for global/static CSS or JavaScript when component-local tags are not appropriate.

## Schema

Use `{% schema %}` for Theme Editor configuration.

Rules:

- If one setting controls one CSS property, prefer a CSS custom property.
- If multiple CSS properties are controlled together, prefer a semantic CSS class.
- Use `select` for configurable layout choices such as mobile column counts.
- Keep schema valid against Shopify's JSON schema.
- Use translated schema labels where appropriate.

Example CSS variable:

```liquid
<div style="--gap: {{ block.settings.gap }}px">
```

Example class:

```liquid
<div class="{{ block.settings.layout }}">
```

## LiquidDoc

Document reusable snippets and relevant blocks with `{% doc %}`.

Include:

- Purpose
- Parameters
- Optional parameters
- Examples

Example:

```liquid
{% doc %}
  Renders a responsive image.

  @param {image} image - Image to render
  @param {string} [url] - Optional destination URL

  @example
  {% render 'image', image: product.featured_image %}
{% enddoc %}
```

## Translation and Localization

Every user-facing string must use the translation system.

Use:

```liquid
{{ 'sections.hero.title' | t }}
```

Do not hardcode UI text directly in Liquid.

Add English translations to:

```text
locales/en.default.json
```

Use:

- Descriptive hierarchical keys
- `snake_case`
- Maximum 3 levels
- Consistent terminology
- Sentence case
- Interpolation for dynamic values

Example:

```json
{
  "sections": {
    "hero": {
      "title": "Welcome to our studio"
    }
  }
}
```

Use interpolation for dynamic values:

```liquid
{{ 'products.price_range' | t: min: product.price_min, max: product.price_max }}
```

Escape variables unless they intentionally output HTML:

```liquid
{{ product.title | escape }}
```

### Locale Files

Keep translation strings in locale JSON files.

Schema locale files (`*.schema.json`) contain translations for Theme Editor schema labels/descriptions and should follow Shopify's locale naming and structure conventions.

## Content Guidelines

- Write clear, concise UI text.
- Use sentence case for user-facing text.
- Keep terminology consistent.
- Consider character limits in UI components.
- Prefer interpolation over concatenating strings.
- Use descriptive variable names.
- Escape dynamic output by default.

## Example Project Structure

For a page containing Hero, About, Services, Portfolio, Testimonials, FAQ, and Contact:

```text
templates/
  page.json

sections/
  hero.liquid
  about.liquid
  services.liquid
  portfolio.liquid
  testimonials.liquid
  faq.liquid
  contact.liquid

blocks/
  service-item.liquid
  portfolio-item.liquid
  faq-item.liquid

snippets/
  button.liquid
  image.liquid
  icon.liquid
```

Use the template to control section order, sections to define page modules, blocks for repeatable/customizable children, and snippets for reusable implementation details.

## Example Snippet

```liquid
{% doc %}
  Renders a responsive image that can optionally be wrapped in a link.

  @param {image} image - Image to render
  @param {string} [url] - Optional destination URL
  @param {string} [css_class] - Optional wrapper class
  @param {number} [width] - Maximum image width
  @param {number} [height] - Maximum image height
  @param {string} [crop] - Crop position
{% enddoc %}

{% liquid
  unless height
    assign width = width | default: image.width
  endunless

  if url
    assign wrapper = 'a'
  else
    assign wrapper = 'div'
  endif
%}

<{{ wrapper }}
  class="image {{ css_class }}"
  {% if url %}
    href="{{ url }}"
  {% endif %}
>
  {{ image | image_url: width: width, height: height, crop: crop | image_tag }}
</{{ wrapper }}>

{% stylesheet %}
  .image {
    display: block;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: auto;
  }

  .image > img {
    width: 100%;
    height: auto;
  }
{% endstylesheet %}
```

## Example Theme Block

Blocks should expose merchant-configurable settings through schema and render nested content when needed.

```liquid
<div
  class="text {{ block.settings.text_style }}"
  style="--text-align: {{ block.settings.alignment }}"
  {{ block.shopify_attributes }}
>
  {{ block.settings.text }}
</div>

{% stylesheet %}
  .text {
    text-align: var(--text-align);
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:general.text",
  "settings": [
    {
      "type": "text",
      "id": "text",
      "label": "t:labels.text",
      "default": "Text"
    },
    {
      "type": "select",
      "id": "text_style",
      "label": "t:labels.text_style",
      "options": [
        { "value": "text--title", "label": "t:options.text_style.title" },
        { "value": "text--subtitle", "label": "t:options.text_style.subtitle" },
        { "value": "text--normal", "label": "t:options.text_style.normal" }
      ],
      "default": "text--title"
    }
  ],
  "presets": [
    { "name": "t:general.text" }
  ]
}
{% endschema %}
```

## Example Nested Group Block

A layout/group block can render child theme blocks:

```liquid
<div
  class="group {{ block.settings.layout_direction }}"
  style="
    --padding: {{ block.settings.padding }}px;
    --alignment: {{ block.settings.alignment }};
  "
  {{ block.shopify_attributes }}
>
  {% content_for 'blocks' %}
</div>
```

The schema can allow:

```json
{
  "blocks": [
    { "type": "@theme" }
  ]
}
```

Use this pattern when a merchant needs nested, reorderable theme blocks.

## Example Section

A section can provide a wrapper/background and render its blocks:

```liquid
<div class="example-section full-width">
  {% if section.settings.background_image %}
    <div class="example-section__background">
      {{ section.settings.background_image | image_url: width: 2000 | image_tag }}
    </div>
  {% endif %}

  <div class="example-section__content">
    {% content_for 'blocks' %}
  </div>
</div>
```

Use section settings for section-level configuration and blocks for the content inside the section.

## Final Development Principles

1. Follow Shopify's native theme architecture.
2. Keep page sections independent and reusable.
3. Use blocks for repeatable/customizable child content.
4. Use snippets for reusable implementation logic.
5. Use section groups/templates for page-level composition.
6. Use schemas for Theme Editor customization.
7. Use LiquidDoc for reusable components.
8. Translate every user-facing string.
9. Escape dynamic variables unless intentionally outputting HTML.
10. Keep component CSS/JS close to the component.
11. Avoid unnecessary duplication.
12. Prefer clarity and maintainability over clever abstractions.
13. Preserve the defined theme palette unless a requirement explicitly changes it.
14. Validate Liquid, JSON schema, and theme structure after changes.
