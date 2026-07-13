# Frida Kahlo — Painting Identity (VOX-Style Video)

A 30-second VOX-style editorial collage video about Frida Kahlo, generated as three
sequential 10-second Kie.ai scenes (GPT Image 2 first frame + Gemini Omni Video chain).

## Quick Start

1. Read `VOX-STYLE.md` for the locked visual rules (Frida moodboard palette and motifs).
2. Read `VOX-SEQUENTIAL-SCENE-WORKFLOW.md` for the scene-by-scene Kie process.
3. The script, sections, and shot plan live in `storyboard/`:
   - `STORYBOARD-FRIDA-KAHLO.md` — master script, section plan, palette, motifs.
   - `frida-kahlo.config.json` — Kie workflow config (default for all commands).
   - `frida-kahlo-sections.json` — the three timed narration sections.
4. The final scene prompts (keyframe-pair choreography) live in `prompts/frida-kahlo/`.

No media is committed to this repo — images and videos are generated locally by the workflow.

## Commands

```bash
npm run kie:check      # verify API key / credit balance
npm run kie:prompts    # write first-image + scene prompts to prompts/frida-kahlo/
npm run kie:run        # full pipeline: prompts -> first image -> 3 scenes -> stitch
```

Partial runs:

```bash
node scripts/kie-sequential-video.mjs write-prompts
KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-first-image
KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-scenes
KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-scenes --scene 02
node scripts/kie-sequential-video.mjs stitch
```

Narration uses Omni's prebuilt female voice `kore` (set in the config); pass `--no-audio` to skip it.
Use `--dry-run` to write task payloads without calling Kie.

## Project Structure

- `scripts/kie-sequential-video.mjs` - Kie.ai automation (keyframe generation, scene generation, stitching).
- `storyboard/` - script, sections, config, and shot plan for this video.
- `prompts/frida-kahlo/` - the handcrafted image and video prompts for all scenes.
- `outputs/` - Kie payloads/results and generated media, ignored by git.
- `assets/audio/` - optional local narration audio, ignored by git.

Use `.env.example` as the local environment template. Never commit real API keys or generated media.
