# Frida Kahlo VOX Kie.ai Video Project

A 30-second Frida Kahlo explainer built with the Kie.ai sequential-scene workflow.

Before doing video work, read:

1. `VOX-STYLE.md` - the locked visual rules: Frida moodboard palette (marigold #F4A300, cobalt #1557A5, magenta #D12C6A, jungle green #2D7A50, terracotta #C65A32, turquoise #2DB7A3 on warm paper #F6F0E6), grayscale halftone cutouts, and project motifs (gold crack line, papel picado, sacred heart, self-portrait grid).
2. `VOX-SEQUENTIAL-SCENE-WORKFLOW.md` - the Kie.ai process for script, sections, first image, scene generation, handoff frames, and stitching.
3. `storyboard/STORYBOARD-FRIDA-KAHLO.md` - the master script and section-by-section shot plan.

## Commands

```bash
npm run kie:check
npm run kie:prompts
npm run kie:run
```

Direct script usage (default config is `storyboard/frida-kahlo.config.json`):

```bash
KIE_API_KEY=... node scripts/kie-sequential-video.mjs check
node scripts/kie-sequential-video.mjs write-prompts
KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-first-image
KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-scenes
KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-scenes --scene 02
node scripts/kie-sequential-video.mjs stitch
```

Use `--dry-run` to write task payloads without calling Kie.

## Project Structure

- `scripts/kie-sequential-video.mjs` - Kie.ai automation; the Frida scene prompts (first image, per-scene briefs, allowed readable text) are built in `buildFirstImagePrompt`, `buildVideoPrompt`, `sceneVisualBrief`, and `sceneReadableText`.
- `storyboard/frida-kahlo.config.json` - Kie workflow config.
- `storyboard/frida-kahlo-sections.json` - the three timed narration sections (10s each).
- `assets/moodboard.png` - visual reference board.
- `prompts/`, `outputs/`, `assets/audio/` - generated artifacts, ignored by git.

## Rules

- NEVER put "Frida" or "Frida Kahlo" (or any famous-person name) in a VIDEO prompt - Gemini's safety filter blocks it. Names/text may only appear baked into images (GPT Image 2 allows it). Photographic likenesses of her also block; all depictions of her must be painted/folk-art style.
- Frida is always static artwork: her face, eyes, and body never move or animate. Cutouts of her move only as rigid paper pieces (slide, stamp, tilt, fade, focus).
- Keyframe workflow: generate each scene's END frame first with `generate-end-image --scene NN --start-frame <prev end/last frame>` (image-to-image keeps the world consistent), then generate video with `generate-scenes --scene NN --no-audio --legacy-upload --end-frame`. Narration and exact text overlays are added locally in post.

- Put `KIE_API_KEY` in your local shell environment or an uncommitted `.env` file before commands that call the API.
- `gemini-omni-video` only accepts durations of 4, 6, 8, or 10 seconds, requires `aspect_ratio` ("16:9" or "9:16") in the input, and needs a prebuilt Gemini voice id in `audio_ids` (custom created audio identities fail with a 500). This project uses "kore" (female, capable, mid pitch); other female options include "sulafat" (warm), "gacrux" (mature), "leda" (young), "zephyr" (bright). "orus" and "puck" are male.
- Keep all three scenes in the same warm-paper collage universe; the gold crack line drawn in scene 01 must return blooming with marigolds in scene 03.
- Do not let the model invent readable text. Each scene's allowed labels are listed in `sceneReadableText`; anything else must be blank cards with text overlaid locally.
- Sections are exactly 10 seconds and sentence-safe; do not split sentences across scenes.
- Each scene prompt preserves the previous frame and asks for a 0.5s still hold before motion.
- Review generated joins; stitch with 0.35s crossfades (offsets 9.65 and 19.30) when continuity is imperfect.
