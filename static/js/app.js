// app.js — Belly Button Biodiversity (clean aesthetic)

const DATA_URL = "./samples.json";

// Plotly config & theme tuned for light, airy look
const PLOT_CONFIG = { responsive: true, displayModeBar: false };
const THEME = {
  font: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12, color: "#2d2d2d" },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "#ffffff",
  hoverlabel: { bgcolor: "#fff", bordercolor: "#e9ecef", font: { size: 11 } }
};

let DATA = null;

const byId = (id) => document.getElementById(id);
const prettyKey = (k) => ({
  id:"ID", ethnicity:"Ethnicity", gender:"Gender", age:"Age",
  location:"Location", bbtype:"BB Type", wfreq:"Wash Freq (wk)",
}[k] || k.replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase()));

// Metadata table
function renderMetadata(meta) {
  const panel = d3.select("#sample-metadata");
  if (panel.empty()) return;
  panel.html("");

  const table = panel.append("table").attr("class","table table-sm mb-0");
  const tbody = table.append("tbody");
  Object.entries(meta).forEach(([k, v]) => {
    const tr = tbody.append("tr");
    tr.append("th").attr("scope","row").style("width","52%").text(prettyKey(k));
    tr.append("td").text(v ?? "—");
  });
}

// Bar: compact margins, subtle grid, wider label gutter
function renderBar(sample) {
  const el = byId("bar"); if (!el) return;
  const vals = sample.sample_values || [];
  const ids  = sample.otu_ids || [];
  const lbls = sample.otu_labels || [];
  const n = Math.min(vals.length, ids.length, lbls.length);

  const top10 = vals.slice(0,n).map((v,i)=>({v,id:ids[i],t:lbls[i]}))
    .sort((a,b)=>b.v-a.v).slice(0,10).reverse();

  const trace = {
    x: top10.map(d=>d.v),
    y: top10.map(d=>`OTU ${d.id}`),
    text: top10.map(d=>d.t),
    type: "bar",
    orientation: "h",
    marker: { color: "rgba(34,102,204,0.9)", line:{color:"rgba(34,102,204,0.4)", width:1} },
    hovertemplate: "%{y}<br>Value: %{x}<extra></extra>"
  };

  const layout = {
    ...THEME,
    margin: { t: 8, r: 8, b: 34, l: 92 },
    xaxis: { title: "Sample Values", gridcolor: "#f2f4f6", zeroline: false, automargin: true },
    yaxis: { title: "OTU IDs",      gridcolor: "#ffffff", automargin: true },
    bargap: 0.18
  };

  Plotly.react(el, [trace], layout, PLOT_CONFIG);
}

// Bubble: restrained colors, clear grid, readable sizes
function renderBubble(sample) {
  const el = byId("bubble"); if (!el) return;
  const x = sample.otu_ids || [];
  const y = sample.sample_values || [];
  const t = sample.otu_labels || [];

  const maxVal = y.length ? Math.max(...y) : 0;
  const sizeref = maxVal ? maxVal / 70 : 1;

  const trace = {
    x, y, text: t, mode: "markers",
    marker: {
      size: y, sizemode: "area", sizeref,
      color: x, colorscale: "Viridis", showscale: true, opacity: 0.9,
      line: { width: 0.5, color: "rgba(0,0,0,0.12)" },
      colorbar: { thickness: 10, outlinewidth: 0 }
    },
    hovertemplate: "OTU %{x}<br>Value: %{y}<extra></extra>"
  };

  const layout = {
    ...THEME,
    margin: { t: 8, r: 28, b: 46, l: 60 },
    xaxis: { title: "OTU IDs", gridcolor: "#f2f4f6", zeroline: false, automargin: true },
    yaxis: { title: "Sample Values", gridcolor: "#f2f4f6", zeroline: false, automargin: true }
  };

  Plotly.react(el, [trace], layout, PLOT_CONFIG);
}

// Gauge: minimal, with soft step colors
function renderGauge(wfreqRaw) {
  const el = byId("gauge"); if (!el) return;
  const wfreq = (typeof wfreqRaw === "number" && isFinite(wfreqRaw)) ? wfreqRaw : 0;

  const data = [{
    type: "indicator",
    mode: "gauge+number",
    value: wfreq,
    number: { font: { size: 18 } },
    gauge: {
      axis: { range: [0, 9], tickwidth: 1, tickcolor: "#9aa4b2" },
      bar: { color: "#2266cc" },
      bgcolor: "#ffffff",
      borderwidth: 0,
      steps: [
        { range: [0, 3], color: "#eaf6ee" },
        { range: [3, 6], color: "#d9efdf" },
        { range: [6, 9], color: "#c7e7d1" }
      ],
      threshold: { line: { color: "#d32f2f", width: 3 }, thickness: 0.75, value: wfreq }
    },
    domain: { x: [0, 1], y: [0, 1] }
  }];

  const layout = { ...THEME, margin: { t: 8, r: 8, b: 8, l: 8 } };

  Plotly.react(el, data, layout, PLOT_CONFIG);
}

// Update all panels
function updateCharts(subjectId) {
  if (!DATA) return;
  const samples = Array.isArray(DATA.samples) ? DATA.samples : [];
  const metas   = Array.isArray(DATA.metadata) ? DATA.metadata : [];

  const sample   = samples.find(s => s.id === subjectId);
  const metadata = metas.find(m => m.id === parseInt(subjectId, 10));
  if (!sample || !metadata) return;

  renderMetadata(metadata);
  renderBar(sample);
  renderBubble(sample);
  renderGauge(metadata.wfreq);
}

// Init
(function init() {
  if (typeof d3 === "undefined" || typeof Plotly === "undefined") {
    console.error("D3 or Plotly not loaded.");
    return;
  }

  d3.json(DATA_URL)
    .then(resp => {
      DATA = resp;

      // Dropdown
      const sel = d3.select("#selDataset");
      const names = Array.isArray(resp.names) ? resp.names : [];
      names.forEach(id => sel.append("option").text(id).property("value", id));

      if (names.length) updateCharts(names[0]);

      sel.on("change", function () {
        updateCharts(sel.property("value"));
      });

      // Debounced resize
      let raf = null;
      window.addEventListener("resize", () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          ["bar","bubble","gauge"].forEach(id => {
            const el = byId(id);
            if (el && Plotly?.Plots) Plotly.Plots.resize(el);
          });
          raf = null;
        });
      });
    })
    .catch(err => {
      console.error("Failed to load samples.json:", err);
      d3.select("#sample-metadata").html('<div class="text-danger">Failed to load data.</div>');
    });
})();
