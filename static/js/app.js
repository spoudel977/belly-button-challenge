// app.js — 2×2 layout, hover-only bar labels, bubble zoom-enlarging,
// gauge, metadata, and DRAGGABLE vertical+horizontal cursor bars on Bar & Bubble

const LOCAL_DATA    = "./samples.json";
const FALLBACK_DATA = "https://static.bc-edx.com/data/dl-1-2/m14/lms/starter/samples.json";

const PLOT_CONFIG = {
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["toImage","lasso2d","select2d"],
  scrollZoom: true,
  doubleClick: "reset",
  // Important: allow dragging shapes (cursor bars)
  editable: true,
  edits: { shapePosition: true } // if ignored by browser, we'll still enforce via relayout
};

const THEME = {
  font: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12, color: "#2d2d2d" },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "#ffffff",
  hoverlabel: { bgcolor: "#ffffff", bordercolor: "#333", font: { size: 14, color: "#111" } }
};

let DATA = null;
const byId = id => document.getElementById(id);

const prettyKey = (k) => ({
  id:"ID", ethnicity:"Ethnicity", gender:"Gender", age:"Age",
  location:"Location", bbtype:"BB Type", wfreq:"Wash Freq (wk)"
}[k] || k.replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase()));

function resizeNow(ids = ["bar","bubble","gauge"]) {
  requestAnimationFrame(() => {
    ids.forEach(id => {
      const el = byId(id);
      if (el && window.Plotly && Plotly.Plots) Plotly.Plots.resize(el);
    });
  });
}

function showDataError(msg) {
  const panel = d3.select("#sample-metadata");
  if (!panel.empty()) panel.html(`<div class="text-danger">${msg}</div>`);
}

function renderMetadata(meta) {
  const panel = d3.select("#sample-metadata");
  panel.html("");
  const table = panel.append("table").attr("class","table table-sm mb-0");
  const tbody = table.append("tbody");
  Object.entries(meta).forEach(([k,v])=>{
    const tr = tbody.append("tr");
    tr.append("th").attr("scope","row").style("width","48%").text(prettyKey(k));
    tr.append("td").text(v ?? "—");
  });
}

/* ------------------------ CURSOR BARS (DRAGGABLE) ------------------------ */
// Create two draggable cursor shapes and enforce vertical/horizontal constraints.
function makeCursorShapesForXY(x, y, opts = {}) {
  const lineStyle = { color: opts.color || "#888", width: opts.width || 1.2, dash: opts.dash || "dot" };

  // Vertical cursor: spans full plot height
  const v = {
    type: "line",
    xref: "x", yref: "paper",
    x0: x, x1: x,
    y0: 0, y1: 1,
    line: lineStyle
  };

  // Horizontal cursor: spans full plot width
  const h = {
    type: "line",
    xref: "paper", yref: "y",
    x0: 0, x1: 1,
    y0: y, y1: y,
    line: lineStyle
  };

  return [v, h];
}

// Ensure shapes remain vertical/horizontal after user drags them.
function clampCursorShapes(gd) {
  const fullLayout = gd._fullLayout;
  if (!fullLayout || !fullLayout.shapes) return;

  const shapes = fullLayout.shapes.map(s => ({...s})); // shallow copy
  let changed = false;

  shapes.forEach((s, i) => {
    if (s.type !== "line") return;

    // If vertical cursor (yref paper)
    if (s.yref === "paper" && s.xref === "x") {
      // keep vertical and full height
      const xmid = (Number(s.x0) + Number(s.x1)) / 2;
      if (s.x0 !== xmid || s.x1 !== xmid || s.y0 !== 0 || s.y1 !== 1) {
        s.x0 = xmid; s.x1 = xmid; s.y0 = 0; s.y1 = 1;
        changed = true;
      }
    }

    // If horizontal cursor (xref paper)
    if (s.xref === "paper" && s.yref === "y") {
      // keep horizontal and full width
      const ymid = (Number(s.y0) + Number(s.y1)) / 2;
      if (s.y0 !== ymid || s.y1 !== ymid || s.x0 !== 0 || s.x1 !== 1) {
        s.y0 = ymid; s.y1 = ymid; s.x0 = 0; s.x1 = 1;
        changed = true;
      }
    }
  });

  if (changed) {
    Plotly.relayout(gd, { shapes });
  }
}

// Add cursors to a graph div, centered at current axis ranges (or a sensible default)
function addDraggableCursors(gd, opts = {}) {
  const layout = gd.layout || gd._fullLayout;
  if (!layout) return;

  // compute midpoints
  const xr = layout.xaxis?.range || layout.xaxis?.domain || null;
  const yr = layout.yaxis?.range || layout.yaxis?.domain || null;

  // When ranges are missing (e.g., categorical y), choose safe midpoints
  const xMid = Array.isArray(xr) && xr.length === 2 ? (Number(xr[0]) + Number(xr[1])) / 2 : 0;
  const yMid = Array.isArray(yr) && yr.length === 2 ? (Number(yr[0]) + Number(yr[1])) / 2 : 0;

  const newShapes = (layout.shapes || []).slice();
  const [v, h] = makeCursorShapesForXY(xMid, yMid, opts);
  newShapes.push(v, h);

  Plotly.relayout(gd, { shapes: newShapes });

  // Keep constraints when user drags the shapes
  gd.on("plotly_relayout", evt => {
    // If any shapes were changed, clamp them
    const keys = Object.keys(evt || {});
    if (keys.some(k => k.startsWith("shapes["))) {
      clampCursorShapes(gd);
    }
  });
}

/* ------------------------ BAR (hover-only labels) ------------------------ */
function renderBar(sample) {
  const vals = sample.sample_values || [];
  const ids  = sample.otu_ids || [];
  const lbls = sample.otu_labels || [];
  const n = Math.min(vals.length, ids.length, lbls.length);

  const top10 = vals.slice(0,n).map((v,i)=>({v,id:ids[i],t:lbls[i]}))
    .sort((a,b)=>b.v-a.v).slice(0,10).reverse();

  const trace = {
    x: top10.map(d=>d.v),
    y: top10.map(d=>`OTU ${d.id}`),
    type: "bar",
    orientation: "h",
    width: 0.55,
    marker: { color: "rgba(34,102,204,0.92)", line:{ color:"rgba(34,102,204,0.35)", width:1 } },
    hovertemplate:
      "<b>%{y}</b><br>Value: %{x}<br>" +
      "<span style='color:#6c757d'>%{customdata}</span>" +
      "<extra></extra>",
    customdata: top10.map(d => d.t)
  };

  const layout = {
    ...THEME,
    margin: { t: 6, r: 10, b: 30, l: 110 },
    xaxis: { title:"Sample Values", gridcolor:"#f2f4f6", zeroline:false, automargin:true },
    yaxis: { title:"OTU IDs",       gridcolor:"#ffffff", automargin:true },
    bargap: 0.28, bargroupgap: 0.1,
    hovermode: "closest",
    dragmode: false,
    shapes: [] // start blank; we'll add cursors below
  };

  Plotly.react("bar", [trace], layout, PLOT_CONFIG);

  // Add draggable cursors (category y is fine; horizontal cursor uses yref:'y')
  addDraggableCursors(byId("bar"), { color: "#666", dash: "dot" });
  resizeNow(["bar"]);
}

/* ---- BUBBLE (zoom-enlarge + clean hover + draggable cursors) ---- */
function renderBubble(sample) {
  const gd = byId("bubble");
  const ids = sample.otu_ids || [];
  const vals = sample.sample_values || [];
  const labels = sample.otu_labels || [];

  // base size (scaled mild so we can grow on zoom)
  const baseSizes = vals.map(v => v * 0.14);

  const trace = {
    x: ids, y: vals, text: labels, mode: "markers",
    marker: {
      size: baseSizes, sizemode: "area",
      color: ids, colorscale: "Turbo", showscale: true, opacity: 0.9,
      line: { width: 0.6, color: "rgba(0,0,0,0.18)" },
      colorbar: { thickness: 10, outlinewidth: 0 }
    },
    hovertemplate:
      "<b>OTU %{x}</b><br>" +
      "Value: %{y}<br>" +
      "<span style='font-size:11px;color:#555;'>%{text}</span>" +
      "<extra></extra>"
  };

  const layout = {
    ...THEME,
    margin: { t: 6, r: 24, b: 36, l: 58 },
    xaxis: { title:"OTU IDs", gridcolor:"#f2f4f6", zeroline:false, automargin:true },
    yaxis: { title:"Sample Values", gridcolor:"#f2f4f6", zeroline:false, automargin:true },
    hovermode: "closest",
    dragmode: "zoom",
    shapes: [] // start blank; we'll add cursors below
  };

  Plotly.react(gd, [trace], layout, PLOT_CONFIG);

  // Enlarge bubbles as you zoom in horizontally; clamp for stability
  gd.on("plotly_relayout", evt => {
    const x0 = evt["xaxis.range[0]"], x1 = evt["xaxis.range[1]"];
    if (typeof x0 !== "number" || typeof x1 !== "number") return;
    const xr = Math.abs(x1 - x0);
    const zoomFactor = Math.min(8, Math.max(1, 3500 / xr)); // tune denominator if needed
    Plotly.restyle(gd, { "marker.size": baseSizes.map(s => s * zoomFactor) });
  });

  // Add draggable cursors
  addDraggableCursors(gd, { color: "#444", dash: "dot" });
  resizeNow(["bubble"]);
}

/* ------------------------------- GAUGE ------------------------------- */
function renderGauge(wfreqRaw) {
  const wfreq = (typeof wfreqRaw === "number" && isFinite(wfreqRaw)) ? wfreqRaw : 0;

  const data = [{
    type: "indicator",
    mode: "gauge+number",
    value: wfreq,
    number: { font: { size: 18 } },
    gauge: {
      axis: { range: [0,9], tickwidth: 1, tickcolor: "#9aa4b2" },
      bar: { color: "#00897b" },
      bgcolor: "#ffffff",
      borderwidth: 0,
      steps: [
        { range:[0,3], color:"#e0f2f1" },
        { range:[3,6], color:"#c8e6e5" },
        { range:[6,9], color:"#b2dfdb" }
      ],
      threshold: { line: { color:"#d32f2f", width:3 }, thickness: 0.75, value: wfreq }
    },
    domain: { x:[0,1], y:[0,1] }
  }];

  const layout = { ...THEME, margin: { t:6, r:10, b:6, l:10 } };
  Plotly.react("gauge", data, layout, PLOT_CONFIG);
  resizeNow(["gauge"]);
}

/* ----------------------------- UPDATE ALL ---------------------------- */
function updateCharts(id) {
  const s = (DATA.samples||[]).find(x=>x.id===id);
  const m = (DATA.metadata||[]).find(x=>x.id===parseInt(id,10));
  if (!s || !m) return;
  renderMetadata(m);
  renderBar(s);
  renderBubble(s);
  renderGauge(m.wfreq);
  resizeNow();
}

/* --------------------------- LOADER (fallback) ------------------------ */
async function loadDataWithFallback() {
  const urls = [LOCAL_DATA, FALLBACK_DATA];
  for (const url of urls) {
    try {
      const resp = await d3.json(url);
      if (resp?.names?.length) {
        console.log("Loaded data from:", url);
        return resp;
      }
    } catch (e) {
      console.warn("Data load failed for", url, e);
    }
  }
  return null;
}

/* -------------------------------- INIT ------------------------------- */
(async function init(){
  if (typeof d3 === "undefined" || typeof Plotly === "undefined") {
    console.error("D3 or Plotly not loaded.");
    showDataError("Libraries failed to load.");
    return;
  }

  DATA = await loadDataWithFallback();
  if (!DATA) { showDataError("Failed to load dataset."); return; }

  const sel = d3.select("#selDataset");
  (DATA.names||[]).forEach(id => sel.append("option").text(id).property("value", id));

  if (DATA.names?.length) updateCharts(DATA.names[0]);
  sel.on("change", ()=> updateCharts(sel.property("value")));

  // Debounced window resize
  let raf = null;
  window.addEventListener("resize", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { resizeNow(); raf = null; });
  });
})();
