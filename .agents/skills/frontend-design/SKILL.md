---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

- If a component (shadcn or custom made) is to be reused, donot change it's styles if not needed.
- If you're unsure about a design aesthetic, contents of the page, information of the page. Always ask the user, you are not a CRUD app.
- If you're unsure about an implementation, always confirm from the user.
- Always reference the current design system.


- Donot use different fonts for headings, other than landing pages. Only use different font for heading in landing pages if it suits the design aesthetic.
- Default font works almost everywhere. Only use special fonts for sections of high gravity (example: landingPage hero, other section title)


- Donot segment nested divs with shadow, border, background all the time in a layout. If a section of the page stands out, you may segment it using the above mentioned.
- Have good breathing space between chunks of related components. Group together logically related components (with some space between, 1x) and put 5x that gap between chunks of unrelated content .
- Minimal and simple is good.

- Shades of white and black looks good with almost every combination. Pick a primary color, have 2 shades of it (default and muted) and compliment it with consistent shades of either white or black depending on the theme.
- Don't add glow or highlight things that user will see very often while using and which is not a CTA section.

- Don't put hover animations on everything. Put micro animations like icons, very subtle bg color change, very subtle border change on hover (for desktop) or active (for mobile)
- For components that are not interactive and more showcasing (example: bento, features section) have illustrations, made out of simple divs and tailwinds. Add subtle idle animations to illustrations.


- Small is good. Having paragraph  or UI texts at 14px on desktop and 16px on mobile looks pleasant.
20px to 22px for headings is fine.