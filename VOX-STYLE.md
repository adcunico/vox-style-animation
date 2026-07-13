# VOX Style - Locked Visual System for Kie.ai

This document defines the visual rules for the **Frida Kahlo — Painting Identity** video. The output should feel like one continuous editorial paper-collage world, even though scenes are generated sequentially. The visual reference board is `assets/moodboard.png`.

## Core Principles

- One continuous visual universe.
- Warm off-white paper background.
- Grayscale magazine cutout subjects.
- Halftone dots, paper texture, grain, and printed edges.
- Short, punchy on-screen labels.
- Layered depth with foreground and background paper pieces.
- Focus shifts through blur, opacity, scale, and contrast.
- Calm, information-forward editorial motion.

## 1. Shared Visual World

Every scene must preserve the same background color, paper texture, palette, lighting, and collage logic. The model may drift or push the camera gently, but it should not introduce a new location, new camera angle, glossy 3D world, neon palette, dramatic lighting, or hard scene reset.

When continuing from a previous frame, prompts should explicitly preserve visible background, cutouts, labels, paper grain, halftone texture, arrows, circles, and any important context from the prior scene.

## 2. Cutout Format

People, buildings, objects, props, documents, vehicles, diagrams, and icons should look like paper cutouts layered on a printed editorial page.

Midground subjects:

- Black and white or grayscale.
- Halftone dot pattern.
- Subtle paper or newsprint texture.
- High contrast, clean silhouette.
- Slightly distressed printed edges are okay.

Prompt seed:

```text
black and white halftone print on textured paper, magazine cutout style, high contrast dots, clean silhouette, editorial collage, analog paper texture
```

Foreground elements:

- May use muted color or a restrained accent.
- Should still feel like printed paper, acetate, pencil marks, labels, or pasted documents.
- Can partially cover midground subjects to create depth.

## 3. Typography and Text

- Keep readable text short: usually 1-8 words.
- Use large labels, stamps, price tags, simple callouts, and short headlines.
- Important text must be listed exactly in the Kie prompt.
- Do not ask the model to generate paragraphs, tiny labels, receipts full of readable text, dense documents, or any text that must be factually perfect.
- For exact factual labels, generate blank paper cards or label areas and add exact text locally afterward.

Recommended text-control language:

```text
Only render the following readable text exactly: "775 ROOMS" and "THE PALACE MACHINE".
Do not invent any other readable words, numbers, signs, labels, captions, or document text.
All other paper cards should be blank or contain unreadable abstract marks.
```

## 4. Layering and Focus

Use a three-layer mental model in prompts:

1. Background paper world: warm off-white paper, grain, faint halftone, soft vignette.
2. Midground subjects: grayscale cutouts, people, buildings, objects, main actors.
3. Foreground graphics: labels, arrows, circles, cards, documents, maps, UI-like editorial overlays.

Focus shifts should be described as rack focus through blur and opacity:

- A new paper element slides in soft, then sharpens.
- Prior elements remain visible but soften, blur, drift, or lower contrast.
- Foreground labels can stamp down or settle with a slight overshoot.
- Older context should recede, not disappear abruptly.

## 5. Motion Language

- Begin each generated scene with a brief still hold on the provided starting frame.
- Entrances: paper slides, stamped labels, drawn circles, expanding radar rings, pasted documents, arrows being sketched.
- Holds: subtle paper parallax, gentle camera drift, tiny settling motion.
- Exits: soft blur, lowered contrast, drift into background context.
- Avoid hard cuts, fast zooms, glossy transitions, explosions, lens flares, dramatic cinematic effects, or photorealistic 3D.

## 6. Palette

Project palette (from the Frida Kahlo moodboard):

- Background: warm paper #F6F0E6, off-white #FBF8F1.
- Cutouts: grayscale halftone and black ink (deep charcoal #111111).
- Accents (Mexican folk-art, used restrained — never more than three dominant at once):
  - Marigold #F4A300 (rough circles, underlines, the sun-circle motif)
  - Cobalt #1557A5 (papel picado, Casa Azul)
  - Magenta #D12C6A (title blocks, flower crown, sacred heart)
  - Jungle green #2D7A50 (Mexico map, botanical elements)
  - Terracotta #C65A32 (PAIN label, earthy scraps)
  - Turquoise #2DB7A3 (sparingly)
- Text: black on cream cards, or off-white on accent-color torn blocks.

Avoid neon gradients, shiny tech UI, over-saturated palettes, and generic AI fantasy textures.

## 6b. Project Motifs

Recurring elements that tie the three scenes together:

- **Gold crack line** ("kintsugi"): drawn in scene 01 when the bus crash shatters the page; returns in scene 03 blooming with marigolds — the wounds-become-voice through-line.
- **Papel picado banners** in cobalt and magenta (scene 03 only).
- **Botanical library**: paper-cut marigolds, hibiscus, monstera leaves.
- **Animal library**: grayscale monkey, parrot, hummingbird cutouts (scene 03).
- **Sacred heart / milagro** cutout in magenta and marigold (scene 02).
- **Self-portrait grid** with a single sharp, flower-crowned central portrait (scenes 02-03).
- Hand-drawn annotations: rough ink arrows, pencil circles, strike-through strokes.

## 7. Pacing and Density

- Narration drives the visuals.
- Each major phrase should trigger one clear visual action.
- Sections should usually run 5-10 seconds.
- Do not overcrowd the frame. Leave negative space so the editorial collage feels designed.
- End every scene on a stable frame that can serve as the next scene's starting frame.

## Enforcement

Any deviation from these rules should be explicit and intentional. The goal is instantly recognizable VOX-style continuity and craft across a Kie-generated sequential scene chain.
