/**
 * Shared icon rendering utility for canvas.
 * Converts Lucide icon data to Path2D operations for crisp, scalable rendering.
 * All Lucide icons use a 24x24 viewBox with stroke-based rendering.
 *
 * Usage:
 *   import { drawIcon, ICON_KEY } from './icons';
 *   drawIcon(ctx, ICON_KEY, x, y, 16, '#333');
 *
 * To add a new icon, just import it from 'lucide' and call fromLucide():
 *   import { Trash2 } from 'lucide';
 *   export const ICON_TRASH = fromLucide(Trash2);
 */
import {
  Braces,
  Brackets,
  Calendar,
  CaseLower,
  Key,
  Link2,
  Sigma,
  SplinePointer,
  ToggleLeft,
} from "lucide";

type IconNode = [string, Record<string, string | number | undefined>][];

interface StrokeOp {
  type: "stroke";
  d: string;
}
interface FillOp {
  type: "fill";
  d: string;
}
type IconOp = StrokeOp | FillOp;

export interface IconDef {
  ops: IconOp[];
}

const pathCache = new Map<string, Path2D>();

function getPath(d: string): Path2D {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
}

function circleToPath(cx: number, cy: number, r: number): string {
  return `M${cx + r} ${cy}a${r} ${r} 0 1 1-${r * 2} 0a${r} ${r} 0 1 1 ${r * 2} 0`;
}

function rectToPath(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
): string {
  if (rx <= 0) {
    return `M${x} ${y}h${w}v${h}h${-w}z`;
  }
  return `M${x + rx} ${y}h${w - rx * 2}a${rx} ${rx} 0 0 1 ${rx} ${rx}v${h - rx * 2}a${rx} ${rx} 0 0 1-${rx} ${rx}h${-(w - rx * 2)}a${rx} ${rx} 0 0 1-${rx}-${rx}v${-(h - rx * 2)}a${rx} ${rx} 0 0 1 ${rx}-${rx}z`;
}

function lineToPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  return `M${x1} ${y1}L${x2} ${y2}`;
}

/**
 * Convert a Lucide icon node array to an IconDef for canvas rendering.
 * Handles path, circle, rect, line, and polyline SVG elements.
 */
export function fromLucide(iconNode: IconNode): IconDef {
  const ops: IconOp[] = [];

  for (const [tag, attrs] of iconNode) {
    let d: string | undefined;
    const isFilled = attrs.fill !== undefined && attrs.fill !== "none";

    switch (tag) {
      case "path":
        d = attrs.d as string | undefined;
        break;
      case "circle":
        d = circleToPath(
          Number(attrs.cx),
          Number(attrs.cy),
          Number(attrs.r),
        );
        break;
      case "rect":
        d = rectToPath(
          Number(attrs.x ?? 0),
          Number(attrs.y ?? 0),
          Number(attrs.width),
          Number(attrs.height),
          Number(attrs.rx ?? 0),
        );
        break;
      case "line":
        d = lineToPath(
          Number(attrs.x1),
          Number(attrs.y1),
          Number(attrs.x2),
          Number(attrs.y2),
        );
        break;
      case "polyline": {
        const points = attrs.points;
        if (points) {
          d = `M${points}`;
        }
        break;
      }
    }

    if (d) {
      ops.push({ type: isFilled ? "fill" : "stroke", d });
    }
  }

  return { ops };
}

/**
 * Draw a pre-converted icon onto a canvas context.
 * Icons are rendered at the given position and size using stroke style.
 */
export function drawIcon({ ctx, icon, x, y, size, color }: {
  ctx: CanvasRenderingContext2D;
  icon: IconDef;
  x: number;
  y: number;
  size: number;
  color: string;
}): void {
  const scale = size / 24;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const op of icon.ops) {
    const path = getPath(op.d);
    if (op.type === "fill") {
      ctx.fill(path);
    } else {
      ctx.stroke(path);
    }
  }

  ctx.restore();
}

// Pre-converted icon definitions
export const ICON_KEY = fromLucide(Key);
export const ICON_LINK2 = fromLucide(Link2);
export const ICON_BRACES = fromLucide(Braces);
export const ICON_BRACKETS = fromLucide(Brackets);
export const ICON_SIGMA = fromLucide(Sigma);
export const ICON_CASE_LOWER = fromLucide(CaseLower);
export const ICON_CALENDAR = fromLucide(Calendar);
export const ICON_SPLINE_POINTER = fromLucide(SplinePointer);
export const ICON_TOGGLE_LEFT = fromLucide(ToggleLeft);
