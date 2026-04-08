Whitepapper public SEO surfaces are profile pages, project pages, and paper pages.

## Profile page

URL:

```
https://whitepapper.antk.in/{username}
```

Profile pages are indexable by default and derive SEO from public account fields.

## Project page

URL:

```
https://whitepapper.antk.in/{username}/p/{project-slug}
```

Project SEO derives from project `name`, `description`, logo, and owner context.

## Collection visibility note

Collections are displayed within the project page view. A dedicated public collection URL route is not currently exposed in the Astro frontend.

## Paper page

URL:

```
https://whitepapper.antk.in/{username}/{paper-slug}
```

Paper pages render full metadata output:

- Standard meta tags
- Open Graph tags
- Twitter tags
- JSON-LD article schema

A paper is publicly accessible only when visibility rules allow it.

## Crawlability notes

- Pages are server-rendered
- Visibility changes apply immediately to access control
- Internal linking from profile and project pages helps discovery
