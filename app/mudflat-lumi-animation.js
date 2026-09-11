const FULL_TURN = Math.PI * 2;
const WALK_CYCLE_DISTANCE = 84;

export function createLumiMotion() {
  return { direction: "side", mirrored: false, phase: 0, moving: 0, tongAngle: 0 };
}

// Movement distance drives the feet; the tool has its own clock. A change in
// equipment speed must not teleport the tool to another angle mid-swing.
export function advanceLumiMotion(motion, { facing, distance, walking, tongSpeed, dt }) {
  const vertical = Math.abs(Math.sin(facing));
  const horizontal = Math.abs(Math.cos(facing));
  const facesVertically = motion.direction === "side"
    ? vertical > horizontal + .16
    : vertical >= horizontal - .16;
  motion.direction = facesVertically ? (Math.sin(facing) >= 0 ? "front" : "back") : "side";
  if (!facesVertically) motion.mirrored = Math.cos(facing) < 0;
  const moving = walking && distance > .001;
  motion.moving += ((moving ? 1 : 0) - motion.moving) * (1 - Math.exp(-dt * 16));
  if (moving) motion.phase = (motion.phase + distance / WALK_CYCLE_DISTANCE) % 1;
  motion.tongAngle = (motion.tongAngle + tongSpeed * dt) % FULL_TURN;
  return motion;
}

export function lumiPose(motion) {
  return {
    row: motion.direction === "front" ? 1 : motion.direction === "back" ? 2 : 0,
    frame: motion.moving > .15 ? Math.floor(motion.phase * 8) % 8 : 0,
    mirror: motion.direction === "side" && motion.mirrored ? -1 : 1,
    bob: Math.sin(motion.phase * Math.PI * 4) * .65 * motion.moving,
  };
}

// The drawn jaw and the collision point share this position. The glove is the
// visible pivot, while the end still follows the existing gameplay reach.
export function lumiTongPose(motion, reach) {
  const pose = lumiPose(motion);
  const handX = motion.direction === "front" ? -14 : motion.direction === "back" ? 14 : 14 * pose.mirror;
  const handY = -14 + pose.bob;
  const tipX = Math.cos(motion.tongAngle) * reach;
  const tipY = Math.sin(motion.tongAngle) * reach;
  const dx = tipX - handX;
  const dy = tipY - handY;
  return { handX, handY, tipX, tipY, angle: Math.atan2(dy, dx), length: Math.hypot(dx, dy), behind: tipY < handY };
}

// Some illustration exporters include their light checkerboard in RGB. Treat
// only edge-connected, near-neutral light pixels as the atlas's display matte;
// enclosed whites (eyes, boot highlights) are never keyed out.
export function clearLumiAtlasMatte(pixels, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0; let tail = 0;
  const enqueue = (index) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const low = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    const high = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    if (pixels[offset + 3] < 32 || (low >= 160 && high - low <= 22)) queue[tail++] = index;
  };
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width); enqueue(y * width + width - 1);
    for (let column = 1; column < 8; column += 1) enqueue(y * width + Math.round(column * width / 8));
  }
  for (let x = 0; x < width; x += 1) {
    enqueue(x); enqueue((height - 1) * width + x);
    for (let row = 1; row < 3; row += 1) enqueue(Math.round(row * height / 3) * width + x);
  }
  while (head < tail) {
    const index = queue[head++];
    pixels[index * 4 + 3] = 0;
    const x = index % width;
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < width * (height - 1)) enqueue(index + width);
  }
}
