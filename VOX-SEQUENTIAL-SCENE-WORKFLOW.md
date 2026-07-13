# The Keyframe-Pair Workflow

How we build a 30-second Vox-style explainer as three 10-second AI-generated scenes
that feel like one continuous film. The central idea: **the video model never invents
a composition — it only animates between two frames you have already approved.**

## Why keyframe pairs

Free-running image-to-video generation drifts: it crowds the frame, redraws faces,
and garbles text. Every failure mode disappears when each scene is pinned at both ends:

- The START image is the scene's exact first frame (for scene 1 it is generated
  from scratch; for later scenes it is the previous clip's extracted last frame).
- The END image is generated *as an image first*, using image-to-image from the
  previous frame so the paper world stays pixel-consistent. Images cost ~10 credits;
  videos cost ~110. You approve the cheap thing before buying the expensive thing.
- The video prompt says: first image = frame 0, second image = final frame, and
  describes exactly four beats between them. Anything not visible in one of the two
  frames is forbidden from appearing.

## Step by step

### 1. Script

Three chunks, each 10 seconds or less (~35 spoken words), hook → twist → payoff.
Never split a sentence across chunks. Save as `storyboard/<project>-sections.json`
with a matching `<project>.config.json`.

### 2. Style pass

Fix the palette, textures, and motifs in `VOX-STYLE.md` before generating anything.
Choose one visual through-line that is planted in scene 1 and pays off in scene 3
(in the Frida film: a gold kintsugi crack that later blooms with flowers).

### 3. Keyframes, scene by scene

```bash
node scripts/kie-sequential-video.mjs generate-first-image
node scripts/kie-sequential-video.mjs generate-end-image --scene 01 --legacy-upload
# scene 2's end frame is conditioned on scene 1's end:
node scripts/kie-sequential-video.mjs generate-end-image --scene 02 --start-frame outputs/<p>/frames/scene-01-end.jpg --legacy-upload
```

Rules for keyframe images:

- Text (titles, labels, quotes) is baked into END frames — GPT Image 2 renders it
  reliably, and the video model then only has to preserve it, not invent it.
- Opening frames stay underbuilt: reserve space for everything that animates in.
- Real people are painted, never photographic (see safety playbook in `CLAUDE.md`).
- Enforce the density budget at the image stage: if the end frame is clean, the
  video has no choice but to converge on a clean composition.

### 4. Video, scene by scene

```bash
node scripts/kie-sequential-video.mjs generate-scenes --scene 01 --no-audio --legacy-upload --end-frame
```

Every video prompt has the same skeleton:

1. What the first image contains; what the second image contains.
2. Exactly four timed beats transforming one into the other. Each narration phrase
   triggers ONE action: a stamp, a tear, a slide, a bloom, a rack focus. At least
   one beat should REMOVE elements instead of adding them.
3. A 0.5s still hold at the start; a settled still hold at the end (a full second
   on the film's final shot).
4. The standing rules: people are static ink on paper; no element outside the two
   frames; camera is one deliberate move (push, pull, or pan — never several).

### 5. When a scene needs three frames (e.g. a camera pan)

Do NOT pass three images to one clip — with three or more references the model
stops treating them as hard constraints and starts redrawing faces and text.
Instead split the scene into two clips that share the middle frame:

```bash
# 4s pan: previous last frame -> mid keyframe
node scripts/... generate-scenes --scene 03 --clip-name scene-03a --duration 4 \
  --prompt-file prompts/<p>/scene-03a-video.txt --start-frame <prev-last> --end-frame <mid>
# 6s finale: mid keyframe -> end keyframe
node scripts/... generate-scenes --scene 03 --clip-name scene-03b --duration 6 \
  --prompt-file prompts/<p>/scene-03b-video.txt --start-frame <mid> --end-frame <end>
```

Join them with a 0.25s crossfade — both clips are anchored on the same image, so
the seam is invisible.

### 6. Stitch

Hard cuts expose the small redraw between one clip's last frame and the next
clip's first frame. A 0.35s crossfade at every join hides it:

```bash
ffmpeg -y -i scene-01.mp4 -i scene-02.mp4 -i scene-03.mp4 -filter_complex "\
[0:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v0];\
[1:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v1];\
[2:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v2];\
[v0][v1]xfade=transition=fade:duration=0.35:offset=9.65[v01];\
[v01][v2]xfade=transition=fade:duration=0.35:offset=19.30[vout]" \
-map "[vout]" -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart master.mp4
```

Offset formula: each offset = sum of prior clip durations − (fade duration × number
of prior joins). Export with `-an`: the master stays silent for post.

### 7. Post-production

- Record the narration separately (e.g. ElevenLabs) — the three script chunks map
  1:1 onto the three scenes. Lay it over the master with ffmpeg.
- Overlay any exact text that was left as blank paper cards.
- Music bed and final grade to taste.

## Review checklist per scene

- [ ] Start and end keyframes approved as images before the video render.
- [ ] Prompt contains no famous person's name (baked image text only).
- [ ] Four beats, one action each, at least one removal beat.
- [ ] Still holds at both ends; faces static throughout.
- [ ] Converged on the end frame? Compare the extracted last frame against the keyframe.
- [ ] Text legible and letter-perfect in the rendered clip.
