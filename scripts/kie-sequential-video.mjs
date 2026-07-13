#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const API_BASE = "https://api.kie.ai";
const UPLOAD_BASE = "https://kieai.redpandaai.co";

loadDotEnv();

function loadDotEnv() {
  const envPath = new URL("../.env", import.meta.url);
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";

if (command === "help" || args.help) {
  printHelp();
  process.exit(0);
}

const configPath = args.config || "storyboard/frida-kahlo.config.json";
const config = readJson(configPath);
const sectionsDoc = readJson(config.sections_path);
const sections = sectionsDoc.sections || [];
const outDir = config.output_dir;
const promptDir = config.prompt_dir;

mkdirSync(outDir, { recursive: true });
mkdirSync(promptDir, { recursive: true });
mkdirSync(join(outDir, "images"), { recursive: true });
mkdirSync(join(outDir, "videos"), { recursive: true });
mkdirSync(join(outDir, "frames"), { recursive: true });
mkdirSync(join(outDir, "tasks"), { recursive: true });

switch (command) {
  case "check":
    await checkCredits();
    break;
  case "create-audio":
    await createAudioIdentity();
    break;
  case "write-prompts":
    writePrompts();
    break;
  case "generate-first-image":
    await generateFirstImage();
    break;
  case "generate-end-image":
    await generateEndImage();
    break;
  case "generate-scenes":
    await generateScenes();
    break;
  case "stitch":
    stitchScenes();
    break;
  case "run":
    writePrompts();
    await generateFirstImage();
    await generateScenes();
    stitchScenes();
    break;
  default:
    throw new Error(`Unknown command: ${command}`);
}

function parseArgs(raw) {
  const parsed = { _: [] };
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2).replaceAll("-", "_");
    const next = raw[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  KIE_API_KEY=... node scripts/kie-sequential-video.mjs check
  KIE_API_KEY=... node scripts/kie-sequential-video.mjs create-audio --audio-id vox-narrator --name "VOX Narrator"
  node scripts/kie-sequential-video.mjs write-prompts
  KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-first-image
  KIE_API_KEY=... node scripts/kie-sequential-video.mjs generate-scenes --audio-id <kieAudioId>
  node scripts/kie-sequential-video.mjs stitch
  KIE_API_KEY=... node scripts/kie-sequential-video.mjs run --audio-id <kieAudioId>

Options:
  --config <path>         Config JSON path.
  --audio-id <id>         Gemini Omni audio/voice ID to pass in input.audio_ids.
  --no-audio              Generate video without Omni narration audio.
  --scene <id>            Generate one scene only, e.g. 01.
  --legacy-upload         Use the original shared Kie upload path and filename.
  --start-frame <path>    Existing first frame image instead of generating one.
  --dry-run               Write task payloads but do not call Kie.
`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function requireKey() {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("Set KIE_API_KEY in the environment.");
  return key;
}

async function kieFetch(url, options = {}) {
  const headers = {
    Authorization: `Bearer ${requireKey()}`,
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  return json;
}

async function checkCredits() {
  const json = await kieFetch(`${API_BASE}/api/v1/chat/credit`);
  console.log(`Kie credit balance: ${json.data}`);
}

async function createAudioIdentity() {
  const audioId = args.audio_id || "vox-narrator";
  const name = args.name || "VOX Narrator";
  const voiceDescription =
    args.voice_description ||
    "A warm, confident female documentary narrator voice. Clear pacing, editorial journalism tone, empathetic but authoritative.";
  const exampleDialogue =
    args.example_dialogue ||
    "A bus crash shattered her spine at eighteen. So Frida Kahlo picked up a paintbrush.";
  const payload = {
    audio_id: audioId,
    name,
    voice_description: voiceDescription,
    example_dialogue: exampleDialogue
  };
  writeJson(join(outDir, "tasks", "create-audio.payload.json"), redact(payload));
  if (args.dry_run) return console.log("Dry run: wrote audio identity payload.");
  const json = await kieFetch(`${API_BASE}/api/v1/omni/audio/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  writeJson(join(outDir, "tasks", "create-audio.response.json"), json);
  console.log(`Created Kie audio ID: ${json.data?.kieAudioId || "(see response file)"}`);
}

function writePrompts() {
  const firstImagePrompt = buildFirstImagePrompt(sections[0]);
  writeFileSync(join(promptDir, "scene-01-image.txt"), firstImagePrompt);
  sections.forEach((section, index) => {
    const prompt = buildVideoPrompt(section, index);
    writeFileSync(join(promptDir, `scene-${section.section_id}-video.txt`), prompt);
  });
  console.log(`Wrote ${sections.length + 1} prompt files to ${promptDir}`);
}

async function generateFirstImage() {
  const promptPath = join(promptDir, "scene-01-image.txt");
  if (!existsSync(promptPath)) writePrompts();
  const payload = {
    model: config.models.first_image,
    input: {
      prompt: readFileSync(promptPath, "utf8"),
      aspect_ratio: config.render.aspect_ratio || "16:9"
    }
  };
  writeJson(join(outDir, "tasks", "scene-01-image.payload.json"), redact(payload));
  if (args.dry_run) return console.log("Dry run: wrote first image payload.");

  const task = await createTask(payload);
  writeJson(join(outDir, "tasks", "scene-01-image.task.json"), task);
  const result = await pollTask(task.data.taskId);
  writeJson(join(outDir, "tasks", "scene-01-image.result.json"), result);
  const [url] = resultUrls(result);
  if (!url) throw new Error("No first image URL found in task result.");
  const imagePath = join(outDir, "images", "scene-01-start-original");
  const downloaded = await downloadUrl(url, imagePath);
  const normalized = join(outDir, "frames", "scene-01-start.jpg");
  normalizeImage(downloaded, normalized);
  console.log(`Saved first frame: ${normalized}`);
}

async function generateEndImage() {
  const scene = String(args.scene || "01").padStart(2, "0");
  const frameName = args.frame_name || "end";
  const promptPath = join(promptDir, `scene-${scene}-${frameName}-image.txt`);
  if (!existsSync(promptPath)) throw new Error(`Missing ${frameName}-image prompt: ${promptPath}`);
  const startFrame = args.start_frame || join(outDir, "frames", `scene-${scene}-start.jpg`);
  if (!existsSync(startFrame)) throw new Error(`Missing start frame to condition on: ${startFrame}`);
  const uploaded = await uploadImage(startFrame, `scene-${scene}-${frameName}-ref.jpg`);
  const payload = {
    model: "gpt-image-2-image-to-image",
    input: {
      prompt: readFileSync(promptPath, "utf8"),
      input_urls: [uploaded],
      aspect_ratio: config.render.aspect_ratio || "16:9"
    }
  };
  writeJson(join(outDir, "tasks", `scene-${scene}-${frameName}-image.payload.json`), redact(payload));
  if (args.dry_run) return console.log(`Dry run: wrote ${frameName} image payload.`);
  const task = await createTask(payload);
  writeJson(join(outDir, "tasks", `scene-${scene}-${frameName}-image.task.json`), task);
  const result = await pollTask(task.data.taskId);
  writeJson(join(outDir, "tasks", `scene-${scene}-${frameName}-image.result.json`), result);
  const [url] = resultUrls(result);
  if (!url) throw new Error(`No ${frameName} image URL found in task result.`);
  const downloaded = await downloadUrl(url, join(outDir, "images", `scene-${scene}-${frameName}-original`));
  const normalized = join(outDir, "frames", `scene-${scene}-${frameName}.jpg`);
  normalizeImage(downloaded, normalized);
  console.log(`Saved ${frameName} frame: ${normalized}`);
}

async function generateScenes() {
  const audioId = args.audio_id || config.omni.audio_ids?.[0];
  if (!args.no_audio && !audioId) {
    throw new Error("Provide --audio-id <kieAudioId> or set omni.audio_ids[0] in the config.");
  }
  const selectedSections = args.scene
    ? sections.filter((section) => section.section_id === String(args.scene).padStart(2, "0"))
    : sections;
  if (args.scene && selectedSections.length === 0) {
    throw new Error(`Unknown scene id: ${args.scene}`);
  }
  let currentFrame = args.start_frame || startFrameForSelection(selectedSections[0]);
  if (!existsSync(currentFrame)) {
    throw new Error(`Missing start frame: ${currentFrame}. Run generate-first-image first or pass --start-frame.`);
  }

  for (const section of selectedSections) {
    const scene = section.section_id;
    const clipName = args.clip_name || `scene-${scene}`;
    const clipDuration = args.duration ? Number(args.duration) : section.duration;
    const uploadFile = args.legacy_upload
      ? `${clipName}-start.jpg`
      : `${config.name || "vox-video"}-${clipName}-start.jpg`;
    const uploaded = args.dry_run
      ? `https://example.com/dry-run/${config.name || "vox-video"}/scene-${scene}-start.jpg`
      : await uploadImage(currentFrame, uploadFile);
    const promptPath = args.prompt_file || join(promptDir, `scene-${scene}-video.txt`);
    if (!existsSync(promptPath)) writePrompts();
    const imageUrls = [uploaded];
    if (args.mid_frame) {
      const midFramePath = args.mid_frame === true
        ? join(outDir, "frames", `scene-${scene}-mid.jpg`)
        : args.mid_frame;
      if (!existsSync(midFramePath)) throw new Error(`Missing mid frame: ${midFramePath}. Run generate-end-image --frame-name mid first.`);
      const uploadedMid = args.dry_run
        ? `https://example.com/dry-run/scene-${scene}-mid.jpg`
        : await uploadImage(midFramePath, `scene-${scene}-mid.jpg`);
      imageUrls.push(uploadedMid);
    }
    if (args.end_frame) {
      const endFramePath = args.end_frame === true
        ? join(outDir, "frames", `scene-${scene}-end.jpg`)
        : args.end_frame;
      if (!existsSync(endFramePath)) throw new Error(`Missing end frame: ${endFramePath}. Run generate-end-image first.`);
      const uploadedEnd = args.dry_run
        ? `https://example.com/dry-run/scene-${scene}-end.jpg`
        : await uploadImage(endFramePath, `scene-${scene}-end.jpg`);
      imageUrls.push(uploadedEnd);
    }
    const input = {
      prompt: readFileSync(promptPath, "utf8"),
      image_urls: imageUrls,
      ...(!args.no_audio ? { audio_ids: [audioId] } : {}),
      duration: String(Math.min(10, Math.ceil(clipDuration))),
      aspect_ratio: config.render.aspect_ratio || "16:9"
    };
    const payload = {
      model: config.models.scene_video,
      input
    };
    writeJson(join(outDir, "tasks", `${clipName}-video.payload.json`), redact(payload));
    if (args.dry_run) {
      continue;
    }

    const task = await createTask(payload);
    writeJson(join(outDir, "tasks", `${clipName}-video.task.json`), task);
    if (!task.data?.taskId) {
      throw new Error(`Kie did not return a task id for ${clipName}: ${task.msg || JSON.stringify(task)}`);
    }
    const result = await pollTask(task.data.taskId, join(outDir, "tasks", `${clipName}-video.result.json`));
    writeJson(join(outDir, "tasks", `${clipName}-video.result.json`), result);
    const [url] = resultUrls(result);
    if (!url) throw new Error(`No video URL found for ${clipName}.`);

    const rawVideo = await downloadUrl(url, join(outDir, "videos", `${clipName}-raw`));
    const trimmedVideo = join(outDir, "videos", `${clipName}.mp4`);
    normalizeVideo(rawVideo, trimmedVideo, clipDuration);
    currentFrame = join(outDir, "frames", `${clipName}-last.jpg`);
    extractLastFrame(trimmedVideo, currentFrame);
    console.log(`${clipName} complete: ${trimmedVideo}`);
  }
}

function stitchScenes() {
  const listPath = join(outDir, "videos", "concat.txt");
  const lines = sections.map((section) => `file '${resolve(join(outDir, "videos", `scene-${section.section_id}.mp4`)).replaceAll("'", "'\\''")}'`);
  writeFileSync(listPath, `${lines.join("\n")}\n`);
  const output = join(outDir, `${config.name || "vox-video"}-stitched.mp4`);
  execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", output], { stdio: "inherit" });
  console.log(`Stitched video: ${output}`);
}

async function createTask(payload) {
  return kieFetch(`${API_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function pollTask(taskId, failurePath) {
  const started = Date.now();
  const interval = Number(config.kie.poll_interval_ms || 5000);
  const timeout = Number(config.kie.poll_timeout_ms || 900000);
  while (Date.now() - started < timeout) {
    await sleep(interval);
    const json = await kieFetch(`${API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
    const state = json.data?.state;
    process.stdout.write(`Task ${taskId}: ${state || "unknown"} ${json.data?.progress ?? ""}\n`);
    if (state === "success") return json;
    if (state === "fail") {
      if (failurePath) writeJson(failurePath, json);
      throw new Error(`Kie task failed: ${json.data?.failCode || ""} ${json.data?.failMsg || ""}`);
    }
  }
  throw new Error(`Timed out polling task ${taskId}`);
}

async function uploadImage(path, fileName) {
  const ext = extname(path).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const base64 = readFileSync(path).toString("base64");
  const json = await kieFetch(`${UPLOAD_BASE}/api/file-base64-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64Data: `data:${mime};base64,${base64}`,
      uploadPath: args.legacy_upload
        ? config.kie.upload_path || "images/vox-video"
        : [config.kie.upload_path || "images/vox-video", config.name || "vox-video"].join("/"),
      fileName
    })
  });
  const url = json.data?.downloadUrl || json.data?.fileUrl;
  if (!url) throw new Error(`Upload response did not contain a usable URL: ${JSON.stringify(json)}`);
  return url;
}

async function downloadUrl(url, targetWithoutExt) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const type = res.headers.get("content-type") || "";
  const ext = type.includes("png")
    ? ".png"
    : type.includes("jpeg") || type.includes("jpg")
      ? ".jpg"
      : type.includes("webp")
        ? ".webp"
        : type.includes("mp4")
          ? ".mp4"
          : extname(new URL(url).pathname) || ".bin";
  const path = `${targetWithoutExt}${ext}`;
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, bytes);
  return path;
}

function normalizeImage(input, output) {
  execFileSync("ffmpeg", [
    "-y",
    "-i",
    input,
    "-vf",
    `scale=${config.render.width}:${config.render.height}:force_original_aspect_ratio=increase,crop=${config.render.width}:${config.render.height}`,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    output
  ], { stdio: "inherit" });
}

function normalizeVideo(input, output, duration) {
  execFileSync("ffmpeg", [
    "-y",
    "-i",
    input,
    "-t",
    String(duration),
    "-vf",
    `fps=${config.render.fps},scale=${config.render.width}:${config.render.height}:force_original_aspect_ratio=increase,crop=${config.render.width}:${config.render.height}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    output
  ], { stdio: "inherit" });
}

function extractLastFrame(video, output) {
  execFileSync("ffmpeg", [
    "-y",
    "-sseof",
    "-0.05",
    "-i",
    video,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    output
  ], { stdio: "inherit" });
}

function resultUrls(result) {
  const raw = result.data?.resultJson;
  if (!raw) return [];
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed.resultUrls || parsed.urls || parsed.videoUrls || parsed.imageUrls || [];
}

function buildFirstImagePrompt(section) {
  return `Create the opening frame for a VOX-style editorial explainer video about Frida Kahlo.

Format: 16:9 landscape, composed for 1920x1080 video.

Narration this frame sets up:
"${section.text}"

Style: editorial explainer-video frame in the style of a modern journalism motion-graphics studio. Tactile paper collage with torn edges and layered depth. Warm paper background (#F6F0E6), faint crumpled-paper texture, low-opacity halftone dot pattern, slight grain throughout. Main subjects are grayscale halftone magazine cutouts, like archival newsprint photography cut out with scissors. Restrained Mexican folk-art accent palette: marigold yellow (#F4A300), cobalt blue (#1557A5), magenta (#D12C6A), jungle green (#2D7A50), terracotta (#C65A32), turquoise (#2DB7A3). Use at most two accent colors in this frame, dominated by magenta and marigold.

Visible at frame 0: a grayscale halftone magazine-cutout of a 1920s Mexico City vintage bus on a cobbled street, clearly separated from the paper ground, placed center-right with open space on the lower third. In the left third of the frame, an archival grayscale halftone portrait cutout of young Frida Kahlo (about age 18, based on her father Guillermo Kahlo's 1920s photographs of her): dark hair pulled back, strong brows, direct serious gaze, simple 1920s blouse, torn-paper cutout edges, newsprint halftone texture, about one quarter of the frame height, positioned center-left. Keep the space directly above her portrait open and calm - a torn paper title block will animate into that space during the video. One paper-cut marigold flower resting near the lower right corner, and one or two small blank torn paper scraps. Keep the page calm and underbuilt so the first video scene has room to animate.

Reserved for animation later; do not show these in the opening image: any title block or text labels, gold crack lines, hospital bed, plaster body cast, overhead mirror, paintbrush, canvas, doctors' silhouettes, hand-drawn arrows, rough circles, pencil underlines, self-portrait frames, papel picado banners, animal cutouts, Mexico map, quote cards, and final headline cards.

Text control: render no readable text anywhere in this image. No words, numbers, signs, labels, captions, document text, stamps, or tiny typography. All paper cards and scraps must be blank or contain only unreadable abstract marks.

Composition: clean, generous negative space, one clear focal point, analog tactile, sophisticated, warm, editorial. Leave enough open space for later paper elements and labels to slide in from the left, top, and lower right. Not glossy, not photorealistic 3D, not AI-slick, no neon colors.`;
}

function buildVideoPrompt(section, index) {
  const sceneNumber = index + 1;
  const narration = spokenNarration(section.text);
  const opener =
    sceneNumber === 1
      ? `The first frame must match the provided opening image exactly: a grayscale halftone magazine-cutout of a 1920s Mexico City vintage bus placed center-right on a warm paper background, an archival grayscale halftone portrait cutout of a young 1920s woman in the center-left third (dark pulled-back hair, strong brows, direct serious gaze, torn cutout edges), one paper-cut marigold in the lower right, blank torn paper scraps, halftone dots, paper texture, an open calm area above the portrait, and generous empty space. There is no readable text in the starting frame.

Starting-frame state:
Already visible at frame 0: the vintage bus cutout, the young woman's portrait cutout on the left, the paper-cut marigold, blank paper scraps, halftone texture, and grain. No text is visible yet.
Not visible yet; animate these on later: the torn magenta paper title block reading "FRIDA" with a small cream date tag reading "1925" (these stamp into the open space beside and above her portrait in the first second, before or as the narration begins), gold crack lines, the steel handrail element, doctors' silhouettes, the hospital bed with the young woman in a plaster body cast, the overhead mirror, the paintbrush, the small canvas, the "AGE 18" tag, and hand-drawn arrows. Never redraw, restyle, or morph the portrait cutout - it must stay exactly as provided, only allowed to soften, blur, or drift as a whole paper piece.`
      : sceneNumber === 2
        ? `The first frame must match the provided previous-scene final frame exactly: a tactile paper-collage frame on a warm crumpled-paper background. A grayscale halftone cutout of a young woman lying in a hospital bed in a plaster body cast, painting on a small canvas, sits center-right with a grayscale mirror cutout suspended above the bed. A thin gold crack line runs across the page like mended pottery. The softened torn vintage bus cutout and an archival halftone portrait cutout of the same young woman remain in the background at low contrast. The magenta "FRIDA" title block and cream "1925" and "AGE 18" tags are still visible. One paper-cut marigold, blank paper scraps, halftone dots, paper texture, and analog grain.

Starting-frame state:
Already visible at frame 0: the woman-in-bed cutout with plaster cast and paintbrush, the overhead mirror cutout, the gold crack line, the softened bus, the young woman's portrait cutout, the magenta "FRIDA" title block, "1925" and "AGE 18" tags, the marigold, paper scraps, halftone texture, and grain.
Not visible yet; animate these on later: the grid of self-portrait paper frames, the "55 SELF-PORTRAITS" label, the "IDENTITY" label, the thorn vine, the pierced sacred-heart paper cutout, the medical corset cutout, the "PAIN" label, and new hand-drawn arrows. Do not add new date tags, new title blocks, or dense document text.`
      : `The first frame must match the provided previous-scene final frame exactly: a tactile paper-collage frame on a warm crumpled-paper background. A grid of grayscale halftone self-portrait paper frames spreads across the page, with the central portrait in sharp focus wearing a magenta-and-marigold paper flower crown. A cream label reads exactly "55 SELF-PORTRAITS" and a torn magenta label reads exactly "IDENTITY". A thorn vine, a pierced sacred-heart paper cutout, and a medical corset cutout sit near the lower left with a small terracotta label reading exactly "PAIN". The gold crack line, softened woman-in-bed cutout, and "FRIDA" title block remain as low-contrast background context.

Starting-frame state:
Already visible at frame 0: the self-portrait grid, the sharp central portrait with flower crown, "55 SELF-PORTRAITS", "IDENTITY", and "PAIN" labels, thorn vine, sacred-heart cutout, corset cutout, gold crack line, softened prior elements, paper texture, and grain.
Not visible yet; animate these on later: the "SURREALIST" label with rough cross-out stroke, the large quote card "I PAINT MY OWN REALITY", the jungle-green torn-paper Mexico map, the cobalt Casa Azul house cutout, papel picado banners, monkey, parrot, and hummingbird cutouts, marigold blossoms along the gold crack, the marigold sun circle, and the "RESILIENCE" label.`;
  const sceneBrief = sceneVisualBrief(section.section_id);
  const narrationBlock = args.no_audio
    ? `This scene is silent - generate no speech, no voiceover, no music, and no sound effects. A narration track will be added locally in post. The quoted phrases below are timing cues for when each visual beat should happen across the ${section.duration.toFixed(0)} seconds, spaced evenly in order; they are not text to render or speak.`
    : `Narration covered in this scene:
"${narration}"

Voice/audio: use the provided Gemini Omni audio ID as the narrator voice. Read the exact narration text above one time only, in a warm, confident, modern journalism documentary tone. Do not repeat, loop, restart, paraphrase, add extra lines, or echo any phrase. If the voice finishes before the visual clip ends, hold the final visual silently with only ambient room tone.`;
  return `Create a ${section.duration.toFixed(2)} second seamless VOX-style video continuation.

${opener} Preserve the same warm off-white paper background, crumpled-paper texture, halftone dots, grayscale cutouts, paper scraps, printed labels, soft vignette, and analog film grain.

${narrationBlock}

Style: Vox-inspired modern journalism explainer video about a celebrated 20th-century Mexican painter, tactile editorial paper collage with torn edges, grayscale halftone magazine-cutout photography on warm paper (#F6F0E6), with restrained Mexican folk-art accents: marigold yellow (#F4A300), cobalt blue (#1557A5), magenta (#D12C6A), jungle green (#2D7A50), terracotta (#C65A32), turquoise (#2DB7A3). Never more than three accent colors dominant at once. Warm, human, information-forward. Not glossy, not photorealistic 3D, not AI-slick.

Text:
Only render the following readable text exactly: ${sceneReadableText(section.section_id)}
Do not invent any other readable words, numbers, signs, labels, captions, document text, stamps, or tiny typography. All other paper elements must be blank or contain unreadable abstract marks.

Animation: no hard cut. Hold the provided starting image completely still for the first 0.5 seconds before any movement. Do not redraw, restyle, relight, reposition, crop, zoom, or reinterpret the starting frame. Then use a slow editorial push or drift with subtle paper parallax. Previous visual elements remain visible as context, but soften, blur, drift, or lower contrast when new narration points become the focus.

Visual content for this section:
${sceneBrief}

Each major phrase should trigger one clear visual action: a paper element slides in, a label stamps down, a rough circle is drawn, a radar line expands, or focus racks from one cutout to another.

Motion language: paper pieces slide and settle with slight overshoot. Use rack focus through blur and opacity. Use rough hand-inked arrows, pencil circles, underlines, imperfect labels, and subtle parallax. Keep the same paper-collage world throughout.

Final frame: end on a stable editorial collage frame with the newest section's main idea clearly visible, older elements still present as softened background context, and enough continuity for the next scene to start from this frame.

Do not change the background color or visual universe. Do not introduce a new camera angle, realistic 3D, glossy interfaces, neon colors, dramatic explosions, cinematic lens flares, or jump cuts.`;
}

function sceneVisualBrief(sectionId) {
  const briefs = {
    "01": `Camera choreography for this scene: after the 0.5 second still hold, begin a slow steady camera push-in toward the bus cutout that lasts through the first narration sentence, building quiet tension. The bus itself never drives or rolls - give it only a faint stop-motion paper jitter, a 1-2 degree rocking like a cutout held by a slightly unsteady hand. At the crash beat, one single sharp page-shake of 2-3 frames, then steady. From "picked up a paintbrush" to the end, the camera slowly pulls back out to a wide stable frame.

Beats: in the first second, stamp a torn magenta paper title block reading exactly "FRIDA" into the open space beside the young woman's portrait cutout with a slight paper overshoot, then paste a small cream date tag reading exactly "1925" just below it - name and face side by side. The portrait cutout stays perfectly intact throughout; it may soften and drift slightly as the camera pushes past it toward the bus. On "A bus crash shattered her spine at 18," the single sharp page-shake hits: tilt the bus cutout and break its paper into two torn pieces while a thin gold crack line draws itself across the page like mended pottery, and stamp a small cream tag reading exactly "AGE 18" near her portrait. On "A steel handrail impaled her body," slide one thin grayscale metal rod element diagonally between the torn bus pieces, restrained and non-graphic, purely symbolic paper collage. On "Doctors said she might never walk again," fade in two soft grayscale doctors' silhouettes at low contrast behind her portrait, then let them blur back. On "picked up a paintbrush - in bed," as the camera pulls back, slide in a grayscale halftone cutout of the same young woman lying in a hospital bed in a plaster body cast, with a mirror cutout suspended above her and a small canvas on her lap; a paintbrush draws one single magenta stroke onto the canvas, the only strong color moment of the scene. End wide and stable with the woman in bed painting center-right, her portrait cutout and the gold crack line still visible, the torn bus softened to background, and the "FRIDA", "1925", and "AGE 18" tags legible.`,
    "02": `Keep the woman-in-bed collage visible, but let it soften and drift left as context. On "While the art world chased abstraction," drift two or three blurred gray abstract paper shapes across the upper background, low contrast, never in focus. On "painted herself - 55 times," multiply a grid of grayscale halftone self-portrait paper frames across the page, pasted one by one with slight overshoot, and stamp a cream label reading exactly "55 SELF-PORTRAITS" with a rough marigold circle around "55". On "Not vanity," stamp a torn magenta label reading exactly "IDENTITY" beside the grid. On "Surgery, miscarriage, heartbreak," slide in three symbolic paper cutouts near the lower left: a thorn vine, a pierced sacred-heart in magenta and marigold like Mexican folk milagro art, and a grayscale medical corset, each connected by rough hand-inked arrows, with a small terracotta label reading exactly "PAIN". On "she put her pain on canvas when no one else would dare," rack focus to the central self-portrait: it sharpens, gains a magenta-and-marigold paper flower crown, and holds a direct unflinching gaze while the rest of the grid softens. End with the portrait grid spread across the page, the central crowned portrait in sharp focus, and the "55 SELF-PORTRAITS", "IDENTITY", and "PAIN" labels visible.`,
    "03": `Keep the self-portrait grid as softened context. On "Critics called her a surrealist," stamp a gray paper label reading exactly "SURREALIST" near the top, then immediately strike one rough black ink line through it. On "She shot back: I paint my own reality," slide a large cream quote card into center frame reading exactly "I PAINT MY OWN REALITY" in bold editorial serif, underline "MY OWN" with a rough marigold pencil stroke. On "Mexico's most famous artist," unfurl a jungle-green torn-paper Mexico map on the left with a small cobalt Casa Azul house cutout pinned to it, and let a row of papel picado banners in cobalt and magenta unfold along the top edge; small grayscale monkey, parrot, and hummingbird cutouts settle gently around the frame. On "she's proof that your wounds can become your voice," make paper marigold and hibiscus blossoms bloom one by one along the gold crack line from scene one, and raise a large marigold sun circle behind the central crowned self-portrait, with a torn jungle-green label reading exactly "RESILIENCE" settling at the lower right. End on a stable final editorial collage: the crowned central portrait centered on the marigold sun circle, papel picado banners along the top, Mexico map left, animals and blossoms placed with negative space, the quote card and "RESILIENCE" label clearly legible.`
  };
  return briefs[sectionId] || "Create specific paper-collage graphics that directly explain the narration while preserving all prior elements as softened context.";
}

function sceneReadableText(sectionId) {
  const text = {
    "01": `"FRIDA", "1925", and "AGE 18".`,
    "02": `"FRIDA", "1925", "AGE 18", "55 SELF-PORTRAITS", "IDENTITY", and "PAIN".`,
    "03": `"55 SELF-PORTRAITS", "IDENTITY", "SURREALIST", "I PAINT MY OWN REALITY", "MY OWN", and "RESILIENCE".`
  };
  return text[sectionId] || "only short labels named in this prompt.";
}

function startFrameForSelection(section) {
  if (!section || section.section_id === "01") return join(outDir, "frames", "scene-01-start.jpg");
  const previous = String(Number(section.section_id) - 1).padStart(2, "0");
  const handoff = join(outDir, "frames", `scene-${previous}-handoff.png`);
  if (existsSync(handoff)) return handoff;
  return join(outDir, "frames", `scene-${previous}-last.jpg`);
}

function spokenNarration(text) {
  return text
    .replace(/\bat 18\b/g, "at eighteen")
    .replace(/\b55 times\b/g, "fifty-five times");
}

function redact(value) {
  return JSON.parse(JSON.stringify(value, (key, val) => {
    if (key.toLowerCase().includes("authorization")) return "[redacted]";
    return val;
  }));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
