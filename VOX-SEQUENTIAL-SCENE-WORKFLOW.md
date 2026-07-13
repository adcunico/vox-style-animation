# VOX Sequential Scene Workflow

Use this workflow when creating a VOX-style video as a chain of generated clips where each scene starts from the previous scene's final frame.

## Goal

Create a polished continuous VOX-style explainer video by planning audio and timing first, then generating each scene prompt from the last frame of the previous scene.

The video should feel like one continuous editorial paper-collage world, not separate unrelated shots.

## Process

### 1. Write the Script

Start with the full narration script.

- Keep it concise and information-forward.
- Write in short sentences where possible.
- Avoid sentences that are so long they force a scene over 10 seconds.

### Text Control Rule

Do not let the image/video model invent readable text.

Readable on-screen text must be explicitly provided in the prompt, and important text should be added locally when exact spelling matters.

Rules:

- Only allow generated text that is specifically named in the prompt.
- Keep generated text short, large, and simple, ideally 1-3 words.
- Use all caps for model-generated labels when possible.
- Never ask the model to generate paragraphs, dense documents, receipts, small labels, or many tiny words.
- For factual labels, numbers, captions, source notes, or anything that must be 100% correct, generate blank paper cards/label areas and overlay the text locally afterward.
- Decorative scribbles, fake document texture, and unreadable background marks are okay if they are not meant to be read.

Recommended prompt language:

```text
Only render the following readable text exactly: "775 ROOMS" and "THE PALACE MACHINE".
Do not invent any other readable words, numbers, signs, labels, captions, or document text.
All other paper cards should be blank or contain unreadable abstract marks.
```

When exact text is needed later:

```text
Create blank paper label cards and empty callout areas where text will be added in post.
Do not render readable text on those cards.
```

### 2. Generate or Choose the Audio

Create the voiceover audio, or use an existing narration file.

After the audio exists, generate a word-level transcript for it.

If a matching word-level transcript already exists, reuse it instead of retranscribing.

### 3. Split the Transcript Into Sections

Break the narration into scene sections using the word-level timings.

Rules:

- Each section must be longer than 5 seconds.
- Each section must be no longer than 10 seconds.
- Never cut a sentence in half.
- If sentences are short, group several sentences together.
- If a sentence is longer than 10 seconds, revise the script or narration before continuing.

Save the section plan in `storyboard/`.

Recommended fields:

```json
{
  "section_id": "01",
  "start": 0.13,
  "end": 8.0,
  "duration": 7.87,
  "text": "Narration text for this scene."
}
```

### 4. Create the First VOX-Style Image

Generate the first image as the opening frame of scene 1.

The image must follow `VOX-STYLE.md`:

- Warm off-white paper background.
- Editorial collage layout.
- Grayscale cutout main subjects.
- Halftone dots, paper texture, film grain.
- Muted palette with one restrained warm yellow accent.
- Hand-drawn arrows, circles, underlines, and labels.
- Clean focal point and generous negative space.
- No invented readable text. Only exact prompted words may appear.

The first image is the literal first frame of the first video. Do not include elements that are supposed to animate on later.

Before generating the first image, separate the scene plan into:

- **Visible at frame 0:** elements that should already exist before motion begins.
- **Reserved for animation:** elements that should appear later during the clip.

The first image prompt must explicitly say that reserved elements are not visible yet.

Example:

```text
Visible at frame 0: Buckingham Palace cutout, warm paper background, faint texture, and the title "ONE BUILDING?"
Reserved for animation later: mini-city grid, department blocks, arrows, labels, post office card, clinic card, security card.
Do not show reserved elements in the opening image. Leave negative space where they can animate in later.
```

### 5. Prompt the First Video Scene

Create the animation prompt for scene 1 using:

- The first image as the starting frame.
- The narration text for section 1.
- The VOX visual rules.
- Clear animation beats tied to the narration.
- A final-frame description that sets up scene 2.

The prompt should explicitly say there is no hard cut and the scene should remain in the same paper-collage world. It should also list which elements are already visible in the starting frame and which elements must animate on later.

### 6. Use the Last Frame to Continue

After scene 1 is generated, export or capture its last frame.

That last frame becomes the starting image for scene 2.

Important: image-to-video models usually use the image as conditioning, not as a pixel-locked first frame. Even if the prompt says "match exactly," the model may redraw the image slightly. The workflow must therefore combine prompt discipline with local edit discipline:

- Extract handoff frames as PNG whenever possible, not JPEG.
- Use a frame near the end that is visually stable. If the final frame has motion blur, extract from about 0.1-0.2 seconds before the end.
- In the prompt, require the first 0.5 seconds to hold the provided image still before any movement.
- After all clips are generated, do a local continuity pass with a short crossfade at every join. This is the reliable fix for the model's non-exact first frame.

Recommended handoff extraction:

```bash
ffmpeg -y -sseof -0.05 -i scene-01.mp4 -frames:v 1 scene-01-handoff.png
```

If that frame is blurry or mid-motion:

```bash
ffmpeg -y -sseof -0.20 -i scene-01.mp4 -frames:v 1 scene-01-handoff.png
```

For scene 2, write a new animation prompt that:

- Starts from the provided last frame exactly.
- Keeps the same background, paper texture, cutouts, labels, and camera world.
- Holds the provided image still for the first 0.5 seconds.
- Lets previous-scene elements soften, drift, blur, or become background context.
- Introduces the new visual ideas required by the next narration section.
- Ends with a clear final frame that can become the start of the following scene.

### 7. Repeat for Every Section

Continue this chain for every transcript section:

1. Take the last frame of the previous scene.
2. Use it as the first frame of the next scene.
3. Include the next section's narration in the prompt.
4. Preserve the VOX theme and continuous collage world.
5. Describe both the animation and the desired final frame.

### 8. Stitch With Continuity Crossfades

After all generated clips are complete, do not simply hard-concat the clips unless the joins already look perfect.

Default local finishing pass:

- Use a 0.35 second video crossfade at every scene join.
- Use a matching 0.35 second audio crossfade at every scene join.
- Re-encode to a single H.264/AAC MP4.

This hides the small redraw/reinterpretation between one generated clip's final frame and the next generated clip's first frame. In testing, this looked better than a hard cut and better than a very short microfade.

For three 8-second clips, the transition offsets are:

```bash
ffmpeg -y \
  -i scene-01.mp4 \
  -i scene-02.mp4 \
  -i scene-03.mp4 \
  -filter_complex "\
[0:v]settb=AVTB,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v0];\
[1:v]settb=AVTB,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v1];\
[2:v]settb=AVTB,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v2];\
[v0][v1]xfade=transition=fade:duration=0.35:offset=7.65[v01];\
[v01][v2]xfade=transition=fade:duration=0.35:offset=15.30[vout];\
[0:a]asetpts=PTS-STARTPTS[a0];\
[1:a]asetpts=PTS-STARTPTS[a1];\
[2:a]asetpts=PTS-STARTPTS[a2];\
[a0][a1]acrossfade=d=0.35:c1=tri:c2=tri[a01];\
[a01][a2]acrossfade=d=0.35:c1=tri:c2=tri[aout]" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  final-crossfade.mp4
```

For other clip durations, each `xfade` offset is:

```text
first offset = clip_1_duration - fade_duration
second offset = clip_1_duration + clip_2_duration - (fade_duration * 2)
third offset = clip_1_duration + clip_2_duration + clip_3_duration - (fade_duration * 3)
```

## Scene Prompt Template

```text
Create a [duration] second seamless continuation from the provided starting frame.
The first frame must match the input image exactly: [describe visible elements].

Starting-frame state:
Already visible at frame 0: [list elements already present].
Not visible yet; animate these on later: [list elements that must not be present at frame 0].

Narration covered in this scene:
"[section narration]"

Style:
Vox-inspired modern journalism explainer video, tactile editorial collage, warm off-white paper background, grayscale magazine-cutout subjects, halftone dots, printed paper texture, muted dusty coral, faded navy, sage, cream, and one restrained warm yellow accent. Analog, calm, trustworthy, information-forward. Not glossy, not photorealistic 3D, not AI-slick.

Text:
Only render the following readable text exactly: [list exact words/labels]. Do not invent any other readable words, numbers, signs, labels, captions, or document text. If a card needs text later, make it blank.

Animation:
No hard cut. Hold the provided starting image completely still for the first 0.5 seconds before any movement. Do not redraw, restyle, relight, reposition, crop, zoom, or reinterpret the starting frame. Then [camera drift/push/parallax].
Previous elements should [soften/blur/drift/recede] while remaining visible as context.
Only introduce the "not visible yet" elements at their specified narration beats.

As the narration says "[phrase 1]," [specific visual action].
As the narration says "[phrase 2]," [specific visual action].
As the narration says "[phrase 3]," [specific visual action].

Motion language:
Paper pieces slide, settle, and overlap with slight overshoot. Use rack focus through blur and opacity. Use rough hand-inked arrows, pencil circles, underlines, imperfect labels, and subtle parallax. Keep the same paper-collage world.

Final frame:
End with [main focal point], [supporting elements], and enough continuity for the next scene to start from this frame.

Do not change the background color or visual universe. Do not introduce a new scene, new camera angle, realistic 3D, glossy interfaces, neon colors, dramatic effects, or jump cuts.
```

## Quality Checklist

Before generating each scene prompt, confirm:

- The section duration is between 5 and 10 seconds.
- No sentence is split across scenes.
- The starting frame is described accurately.
- The first image does not include elements that are supposed to animate on later.
- The prompt separates "already visible" elements from "not visible yet" elements.
- The scene prompt requests a 0.5 second still hold on the starting image.
- The prompt includes the exact narration for the section.
- The prompt lists every readable word the model is allowed to generate.
- Factual or small text is planned as local overlay, not model-generated text.
- The scene preserves the VOX visual language.
- Previous elements remain as context instead of disappearing abruptly.
- New elements directly support the narration.
- The final frame is described clearly enough to continue the chain.
- Handoff frames are extracted as PNG or another lossless/stable format.
- The final stitched output uses the 0.35 second crossfade continuity pass unless the joins have been manually reviewed and approved as hard cuts.
