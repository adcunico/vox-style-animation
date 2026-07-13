# Vox Style Animation

A keyframe-driven workflow for producing VOX-style editorial paper-collage explainer
videos with AI — GPT Image 2 for approved keyframes, Gemini Omni Video to animate
between them, stitched with ffmpeg. Includes a complete worked example: a 30-second
Frida Kahlo explainer built as three sequential 10-second scenes.

## Use it as a Claude Code skill

Clone this repo and open it in [Claude Code](https://claude.com/claude-code) — the
`vox-style-video` skill in `.claude/skills/` teaches Claude the whole pipeline. Then just ask:

> Make a 30-second Vox-style video about [your topic]

Claude will write the script, design the keyframes for your approval, generate the
scenes, and stitch the master. You bring a [Kie.ai](https://kie.ai) API key and ffmpeg.

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

## Acknowledgment

The Kie.ai API plumbing in `scripts/` started from a community vox-style-video starter
project and was substantially extended here (keyframe-pair generation, mid-frame pans,
clip splitting, the safety-filter playbook, and all creative content).
