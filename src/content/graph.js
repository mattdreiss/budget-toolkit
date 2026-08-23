window.BudgetToolkit = window.BudgetToolkit || {};

window.BudgetToolkit.renderGraph = function renderGraph(container, dailyCents) {
  container.innerHTML = "";

  const dates = Object.keys(dailyCents).sort();
  const values = dates.map((date) => dailyCents[date] / 100);

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 150;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const padding = 20;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const xStep = width / Math.max(values.length - 1, 1);
  const xFor = (index) => padding + index * xStep;
  const yFor = (value) => padding + height - ((value - min) / range) * height;

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, yFor(0));
  ctx.lineTo(padding + width, yFor(0));
  ctx.stroke();

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = xFor(index);
    const y = yFor(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const totalCents = dates.reduce((sum, date) => sum + dailyCents[date], 0);
  const caption = document.createElement("div");
  caption.className = "budget-toolkit-graph-caption";
  caption.textContent = `Total spent this month: ${window.BudgetToolkit.centsToDollars(totalCents)}`;
  container.appendChild(caption);
};
