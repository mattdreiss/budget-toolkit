import type { SpendSeries } from "../domain/budget/spendSeries.js";

const HEIGHT = 200;
/**
 * Width to draw at before layout has given the container one.
 *
 * There has to be a fallback rather than an early return. The panel is rendered
 * from the budget event, which can arrive while the panel is still detached —
 * `mountPanel` is waiting on `EDSPageLayout.Main` to exist — and at that moment
 * `clientWidth` is 0. Bailing out left the section heading with nothing under it
 * and made the chart depend entirely on a later `ResizeObserver` callback to
 * ever appear at all. Drawing at a default instead means the chart is always
 * there, and the observer's job is narrowed to what it is actually good at:
 * correcting the width once it is known.
 */
const FALLBACK_WIDTH = 600;
/** Room for the dollar labels on the left, day numbers underneath, and the top-most point. */
const INSET = { top: 14, right: 10, bottom: 22, left: 52 };
const Y_TICKS = 4;

// Sampled from EveryDollar's own palette so the chart reads as part of the app.
const GRID_COLOUR = "#eef1f3";
const AXIS_COLOUR = "#c3cbcf";
const LABEL_COLOUR = "#495257";
const LINE_COLOUR = "#0073b9";
const FILL_COLOUR = "rgba(0, 115, 185, 0.1)";

/**
 * Draws daily spending as a full-width line chart, with the month's total
 * beneath it.
 *
 * The series is stashed on the container and redrawn from a `ResizeObserver`
 * rather than only on new data. A canvas has a fixed pixel buffer, so a chart
 * sized once at `document_idle` — when EveryDollar's column may not have its
 * final width, or the window is later resized — would stay stretched or
 * cropped. Redrawing on width change is what actually makes "full width" hold.
 */
export function renderSpendChart(container: HTMLElement, spend: SpendSeries): void {
  state.set(container, spend);
  observe(container);
  draw(container, spend);
}

const state = new WeakMap<HTMLElement, SpendSeries>();
const observed = new WeakSet<HTMLElement>();

function observe(container: HTMLElement): void {
  if (observed.has(container)) return;
  observed.add(container);

  new ResizeObserver(() => {
    const spend = state.get(container);
    if (spend) draw(container, spend);
  }).observe(container);
}

function draw(container: HTMLElement, spend: SpendSeries): void {
  const width = container.clientWidth || FALLBACK_WIDTH;

  const canvas = document.createElement("canvas");
  // The canvas is sized in device pixels and scaled back down in CSS, so the
  // line stays sharp on the retina displays this is mostly viewed on.
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(HEIGHT * ratio);
  canvas.style.width = "100%";
  canvas.style.height = `${HEIGHT}px`;

  const caption = document.createElement("div");
  caption.className = "budget-toolkit-graph-caption";
  caption.textContent = `Total spent this month: ${spend.total().format()}`;

  container.replaceChildren(canvas, caption);

  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  plot(context, width, spend);
}

function plot(
  context: CanvasRenderingContext2D,
  width: number,
  spend: SpendSeries,
): void {
  const values = spend.days.map((day) => day.amount.toDollars());
  const plotWidth = width - INSET.left - INSET.right;
  const plotHeight = HEIGHT - INSET.top - INSET.bottom;

  // Zero is always on the scale, so a month of small spends is not stretched to
  // look like a month of large ones. The top is rounded up to a readable number
  // so the axis labels are $200 and $400 rather than $187.43.
  const max = niceCeiling(Math.max(0, ...values));
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const xStep = plotWidth / Math.max(values.length - 1, 1);
  const xFor = (index: number) => INSET.left + index * xStep;
  const yFor = (value: number) =>
    INSET.top + plotHeight - ((value - min) / range) * plotHeight;

  context.font =
    '11px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  context.textBaseline = "middle";

  drawGrid(context, { max, min, xFor, yFor, width: plotWidth });
  drawDayLabels(context, spend, xFor);
  drawSeries(context, values, xFor, yFor);
}

interface Scale {
  max: number;
  min: number;
  xFor: (index: number) => number;
  yFor: (value: number) => number;
  width: number;
}

function drawGrid(context: CanvasRenderingContext2D, scale: Scale): void {
  context.textAlign = "right";

  for (let tick = 0; tick <= Y_TICKS; tick++) {
    const value = scale.min + ((scale.max - scale.min) * tick) / Y_TICKS;
    const y = Math.round(scale.yFor(value)) + 0.5;
    const isZero = Math.abs(value) < 0.005;

    context.strokeStyle = isZero ? AXIS_COLOUR : GRID_COLOUR;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(INSET.left, y);
    context.lineTo(INSET.left + scale.width, y);
    context.stroke();

    context.fillStyle = LABEL_COLOUR;
    context.fillText(formatTick(value), INSET.left - 8, y);
  }
}

/**
 * Day numbers along the bottom, thinned to whatever fits.
 *
 * Every day is a data point, but 31 labels do not fit in a column this width at
 * a legible size, so the step grows until they do. The last day is always
 * labelled, so the axis reads as the whole month rather than stopping at 29.
 */
function drawDayLabels(
  context: CanvasRenderingContext2D,
  spend: SpendSeries,
  xFor: (index: number) => number,
): void {
  const count = spend.days.length;
  if (count === 0) return;

  const step = [1, 2, 5, 7].find((candidate) => count / candidate <= 12) ?? 7;
  const y = HEIGHT - INSET.bottom / 2;

  context.fillStyle = LABEL_COLOUR;
  context.textAlign = "center";

  for (let index = 0; index < count; index += step) {
    context.fillText(String(index + 1), xFor(index), y);
  }
  if ((count - 1) % step !== 0) {
    context.fillText(String(count), xFor(count - 1), y);
  }
}

function drawSeries(
  context: CanvasRenderingContext2D,
  values: readonly number[],
  xFor: (index: number) => number,
  yFor: (value: number) => number,
): void {
  if (values.length === 0) return;

  const trace = () => {
    context.beginPath();
    values.forEach((value, index) => {
      const x = xFor(index);
      const y = yFor(value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  };

  // Filled first, so the stroke sits on top of its own edge rather than under it.
  trace();
  context.lineTo(xFor(values.length - 1), yFor(0));
  context.lineTo(xFor(0), yFor(0));
  context.closePath();
  context.fillStyle = FILL_COLOUR;
  context.fill();

  trace();
  context.strokeStyle = LINE_COLOUR;
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();

  // A dot only where something happened: on a month with a handful of
  // transactions the line alone is mostly flat and the spend days are easy to
  // miss, and marking all 31 days would just be noise.
  context.fillStyle = LINE_COLOUR;
  values.forEach((value, index) => {
    if (value === 0) return;
    context.beginPath();
    context.arc(xFor(index), yFor(value), 2.5, 0, Math.PI * 2);
    context.fill();
  });
}

/** Rounds an axis maximum up to 1, 2 or 5 times a power of ten. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => value <= multiple * magnitude) ?? 10;
  return step * magnitude;
}

function formatTick(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
