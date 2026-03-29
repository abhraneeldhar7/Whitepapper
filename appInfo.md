# WhitePapper

- CMS platform with SEO enforced.
- Has a dev api to be used in other projects.
- Has dsitribution pipeline to cross post onto other platforms.

## App structure
- Users can have standalone papers or organize them into projects.
- Projects can have standalone papers or group them together into collections.
- Projects can have their own project logo, rich text description.
- One apikey per project, only GET requests for now.

## Paper structure
- Each paper have their own thumbnail and title.
- The content below is the markdown string which is rendered on browser.
- Author and metadata are internally managed.

## API endpoints
- /dev/project      to get project details
- /dev/collection?id=COLLECTION_ID or /dev/collection?slug=COLLECTION_SLUG      to get collection details
- /dev/paper?id=PAPER_ID or /dev/paper?slug=PAPER_SLUG      to get paper details

## Integrations
Whitepapper has integrations with
- Hashnode
- Devto
- Reddit
- Threads
- Peerlist
- Substack

## Other features
- Auto convert article into chunked tweets.
- In-built text editor.
- Bulk export project papers.


## Free react components
- Table of content island for mobile view.
- Edge table of content for desktop.