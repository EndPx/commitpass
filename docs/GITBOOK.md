# CommitPass GitBook source

Public documentation lives in `docs/gitbook/`. `SUMMARY.md` defines the page order
and groups. This source covers the current Monad testnet USDC release, signed CRE
CLI broadcast and the completed one-attendee frontend flow.

Use Git Sync with repository `EndPx/commitpass`, branch `main`, project directory
`docs/gitbook`, and initial direction **GitHub to GitBook**. The local `.gitbook.yaml`
selects `README.md` and `SUMMARY.md`. Inspect navigation, internal links, the banner
and Mermaid diagrams before publishing.

The generic ZIP importer was checked in a new space. It created filename-based
page titles, an extra SUMMARY page and unresolved internal file URLs, so that
draft is not the publication source. A locally generated ZIP remains available
as a portable source archive. Disable optional AI rewriting for any future import
so exact addresses, transaction hashes and financial rules are preserved.

The source and GitBook publication are separate states. Record the actual space
and public site URLs here after the import and public page have been verified.
Git Sync is not configured by adding these files.

## Original cover artwork

`gitbook/assets/commitpass-community.png` was generated with the built-in image
tool on 1 October 2026. It is an illustrative community scene, not a product
screenshot, a photo of real users or evidence of a real gathering.

Generation prompt:

> Use case: illustration-story. Asset: an original wide editorial cover illustration for CommitPass documentation, an event app where community guests commit to showing up. Landscape 2.4:1 composition, high quality clean contemporary cut-paper and gouache illustration with subtle fine paper texture. A welcoming small community meetup in a sunlit courtyard, abstract geometric adult figures gathered around a round workshop table and a few standing beside event poster boards. Friendly human connection, visible empty-to-full gathering motif, a small simple terracotta ticket/pass with a checkmark in the foreground but no logo. Warm ivory backdrop #FAF9F6, main terracotta #B9462D, restrained apricot, sage green, muted sky blue and mustard accents from the CommitPass event posters. Bold simple geometric shapes, generous airy negative space, balanced quiet composition suitable for GitBook above prose. Wide view, subjects grouped across middle and right, not crowded. No text, no letters, no labels, no screenshots, no UI, no coins, no chart, no invented performance data, no photorealism, no glossy 3D, no gradients, no neon, no watermark. Illustrative scene, not a depiction of real users or a real event.

`gitbook/assets/commitpass-mark.png` copies the existing application mark without
modification. Its original provenance is recorded in `apps/web/public/brand/README.md`.

## Branded cover revision

The published cover uses `gitbook/assets/commitpass-community-v2.png`. It was edited
with the built-in image tool using the original cover as the target and the actual
application mark as the insert reference. The original file remains available.

Edit prompt:

> Use case: precise-object-edit. Image 1 is the edit target, the wide CommitPass community courtyard cover illustration. Image 2 is a supporting insert/reference: the actual CommitPass brand mark, a rounded open C enclosing a checkmark, terracotta on transparent. Make exactly one local change to Image 1: replace the generic standalone checkmark inside the cream circular badge on the foreground terracotta ticket in the lower left with the actual CommitPass C-and-check mark from Image 2. Preserve the exact distinctive open-C enclosing-check silhouette, rounded proportions, spacing and orientation of the reference mark. Render it in terracotta on the existing cream circular ticket badge and match the ticket's slight perspective so it looks printed on that ticket. Fit the mark clearly within the existing badge with a clean margin. Preserve all the people, all faces, hands, courtyard, poster art, foliage, lighting, palette, gouache texture, composition, ticket outline, camera framing and 2.4:1 image dimensions. Do not redesign the brand mark, do not add text, do not add logos elsewhere, do not change any other part of the image. The C-and-check symbol must be recognizable as the supplied logo, not merely a standalone checkmark.
