import { clearLumiAtlasMatte, createLumiMotion, lumiPose, lumiTongPose } from "./mudflat-lumi-animation.js";

type Motion = ReturnType<typeof createLumiMotion>;
type Frame = { x: number; y: number; width: number; height: number; anchorX: number; baseline: number; scale: number };
export type LumiArt = { image: HTMLCanvasElement; frames: Frame[] };

export function loadLumiArt(): LumiArt {
  const source = new Image();
  const art: LumiArt = { image: document.createElement("canvas"), frames: [] };
  source.onload = () => {
    // Read alpha once when the atlas loads, not during animation. Register each
    // pose by its helmet center and lowest boot so image padding cannot jitter.
    const canvas = art.image;
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(source, 0, 0);
    const bitmap = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = bitmap.data;
    clearLumiAtlasMatte(pixels, canvas.width, canvas.height);
    context.putImageData(bitmap, 0, 0);
    const cellWidth = canvas.width / 8;
    const cellHeight = canvas.height / 3;
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const x = Math.round(column * cellWidth);
        const y = Math.round(row * cellHeight);
        const width = Math.round((column + 1) * cellWidth) - x;
        const height = Math.round((row + 1) * cellHeight) - y;
        let top = height; let bottom = -1; let helmetLeft = width; let helmetRight = -1;
        for (let py = 0; py < height; py += 1) {
          for (let px = 0; px < width; px += 1) {
            if (pixels[((y + py) * canvas.width + x + px) * 4 + 3] < 96) continue;
            top = Math.min(top, py); bottom = Math.max(bottom, py);
          }
        }
        const helmetBottom = top + (bottom - top) * .25;
        for (let py = top; py <= helmetBottom; py += 1) {
          for (let px = 0; px < width; px += 1) {
            if (pixels[((y + py) * canvas.width + x + px) * 4 + 3] < 96) continue;
            helmetLeft = Math.min(helmetLeft, px); helmetRight = Math.max(helmetRight, px);
          }
        }
        art.frames.push({ x, y, width, height,
          anchorX: helmetRight >= helmetLeft ? (helmetLeft + helmetRight) / 2 : width / 2,
          baseline: bottom >= 0 ? bottom : height * .94,
          scale: bottom > top ? 96 / (bottom - top) : 96 / height,
        });
      }
    }
  };
  source.src = "/mudflat-illustrations/lumi-walk-atlas-v2.png";
  return art;
}

function drawLumiTongs(context: CanvasRenderingContext2D, motion: Motion, reach: number) {
  const tool = lumiTongPose(motion, reach);
  context.save();
  context.translate(tool.handX, tool.handY);
  context.rotate(tool.angle);
  context.lineCap = "round";
  const jawBase = tool.length - 12;
  // Extend the existing game's canvas tongs: wood grip, paired metal shaft and
  // small serrated jaws instead of cycling an entire character illustration.
  context.strokeStyle = "rgba(24,25,23,.45)"; context.lineWidth = 7;
  context.beginPath(); context.moveTo(-7, 2); context.lineTo(jawBase, 2); context.stroke();
  context.strokeStyle = "#86603b"; context.lineWidth = 5;
  context.beginPath(); context.moveTo(-7, 0); context.lineTo(jawBase, 0); context.stroke();
  context.strokeStyle = "#d3b080"; context.lineWidth = 1.4;
  context.beginPath(); context.moveTo(-6, -1.2); context.lineTo(jawBase - 4, -1.2); context.stroke();
  const aperture = 4.3 + Math.sin(motion.tongAngle * 2) * 1.2;
  for (const sign of [-1, 1]) {
    context.strokeStyle = "#40514f"; context.lineWidth = 3.8;
    context.beginPath(); context.moveTo(jawBase - 3, 0); context.quadraticCurveTo(tool.length, sign * 10, tool.length + 8, sign * aperture); context.stroke();
    context.strokeStyle = "#dee5d9"; context.lineWidth = 1.8; context.stroke();
    for (let tooth = 0; tooth < 3; tooth += 1) {
      const toothX = tool.length - 2 + tooth * 3;
      context.beginPath(); context.moveTo(toothX, sign * 6); context.lineTo(toothX - 1, sign * 3.7); context.stroke();
    }
  }
  // A glove over the handle connects the continuous swing to the character.
  context.fillStyle = "#315b55";
  context.beginPath(); context.ellipse(0, 0, 5.5, 4.2, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "#73857a"; context.lineWidth = 1; context.stroke();
  context.restore();
}

export function drawLumiGatherer(context: CanvasRenderingContext2D, x: number, y: number,
  motion: Motion, art: LumiArt, elapsed: number, damaged: boolean, hasHeadlamp: boolean, tongReach: number) {
  if (art.frames.length !== 24) return false;
  const pose = lumiPose(motion);
  const frame = art.frames[pose.row * 8 + pose.frame];
  const upperBody = art.frames[pose.row * 8];
  const tool = tongReach > 0 ? lumiTongPose(motion, tongReach) : null;
  context.save(); context.translate(x, y);
  context.fillStyle = "rgba(24,20,17,.24)";
  context.beginPath(); context.ellipse(0, 23, 21, 6, 0, 0, Math.PI * 2); context.fill();
  if (tool?.behind) drawLumiTongs(context, motion, tongReach);
  context.save(); context.translate(0, 22 + pose.bob); context.scale(pose.mirror, 1);
  const breath = 1 + Math.sin(elapsed * 2.4) * .003 * (1 - motion.moving);
  context.scale(1, breath);
  context.globalAlpha = damaged ? .7 + Math.sin(elapsed * 36) * .18 : 1;
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
  // Keep the gripping hand and face steady while only the walking legs cycle.
  // Both layers use the same grounded registration; the waist overlaps by 1px.
  context.save(); context.beginPath(); context.rect(-80, -30, 160, 33); context.clip();
  context.drawImage(art.image, frame.x, frame.y, frame.width, frame.height,
    -frame.anchorX * frame.scale, -frame.baseline * frame.scale, frame.width * frame.scale, frame.height * frame.scale);
  context.restore();
  context.save(); context.beginPath(); context.rect(-80, -110, 160, 81); context.clip();
  context.drawImage(art.image, upperBody.x, upperBody.y, upperBody.width, upperBody.height,
    -upperBody.anchorX * upperBody.scale, -upperBody.baseline * upperBody.scale, upperBody.width * upperBody.scale, upperBody.height * upperBody.scale);
  context.restore();
  context.restore();
  if (hasHeadlamp && motion.direction !== "back") {
    const lampX = motion.direction === "side" ? 7 * pose.mirror : 0;
    const glow = context.createRadialGradient(lampX, -59 + pose.bob, 1, lampX, -59 + pose.bob, 17);
    glow.addColorStop(0, "rgba(255,248,179,.55)"); glow.addColorStop(1, "rgba(255,232,151,0)");
    context.fillStyle = glow; context.beginPath(); context.arc(lampX, -59 + pose.bob, 17, 0, Math.PI * 2); context.fill();
  }
  if (tool && !tool.behind) drawLumiTongs(context, motion, tongReach);
  context.restore();
  return true;
}
