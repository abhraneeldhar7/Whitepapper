The editor supports four types of image uploads: thumbnail, embedded images in the paper body, and images inside the metadata fields. Each type is stored and handled separately.

## Thumbnail

The thumbnail is the cover image for a paper. It appears at the top of the public paper page and is used as the default value for the `ogImage` metadata field if you haven't set one manually.

- Uploaded from the paper sidebar in the editor.
- Stored independently from the paper body.
- Removing the thumbnail does not affect any embedded images.

## Embedded images

Embedded images are images you insert directly into the paper body using Markdown syntax:

```markdown
![alt text](image-url)
```

You can upload images directly from the editor toolbar. The uploaded image URL is inserted into the body automatically.

- Maximum **20 embedded images** per paper.
- This limit is enforced on every save and on every individual upload attempt.
- If you hit the limit on save: `Paper image limit reached (20). Remove some images before saving.`
- If you hit the limit when uploading a new image: `Paper image limit reached (20). Remove some images before uploading a new one.`

Deleting an embedded image from the body doesn't automatically delete the uploaded file from storage, but it does free up a slot in the count for that paper.

## Metadata images

The metadata panel has its own image upload fields, specifically for `ogImage` and `twitterImage`. These are separate from the thumbnail and from embedded body images.

- Uploaded from inside the metadata editor panel.
- Stored separately from body images.
- Not counted toward the 20 embedded image limit.

If you want the thumbnail to also serve as the OG image, you can copy the thumbnail URL into the `ogImage` field in the metadata panel, or let auto-generate handle it.

## Upload behavior

All image uploads go to Whitepapper's storage. Uploads are tied to the paper they're uploaded from. There is no global media library shared across papers.
\nLast updated: 12th April, 2026\n
