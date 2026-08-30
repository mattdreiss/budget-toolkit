import type { SpendSeries } from "../domain/budget/spendSeries.js";

const HEIGHT = 160;
const PADDING = 20;
// Sampled from EveryDollar's own palette so the chart reads as part of the app.
const AXIS_COLOUR = "#c3cbcf";
const LINE_COLOUR = "#0073b9";

/** Draws net expense spending per day as a line chart, with a monthly total beneath. */
export function renderSpendChart(container: HTMLElement, spend: SpendSeries): void {
  container.replaceChildren();

  const values = spend.days.map((day) => day.amount.toDollars());
  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth || 600;
  canvas.height = HEIGHT;
  container.append(canvas);

  const context = canvas.getContext("2d");
  if (context) drawLine(context, canvas, values);

  const caption = document.createElement("div");
  caption.className = "budget-toolkit-graph-caption";
  caption.textContent = `Total spent this month: ${spend.total().format()}`;
  container.append(caption);
}

function drawLine(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  values: readonly number[],
): void {
  const width = canvas.width - PADDING * 2;
  const height = canvas.height - PADDING * 2;

  // Zero is always on the scale, so a month of small spends does not get
  // stretched to look like a month of large ones.
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const xStep = width / Math.max(values.length - 1, 1);
  const xFor = (index: number) => PADDING + index * xStep;
  const yFor = (value: number) => PADDING + height - ((value - min) / range) * height;

  context.strokeStyle = AXIS_COLOUR;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(PADDING, yFor(0));
  context.lineTo(PADDING + width, yFor(0));
  context.stroke();

  context.strokeStyle = LINE_COLOUR;
  context.lineWidth = 2;
  context.beginPath();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}
