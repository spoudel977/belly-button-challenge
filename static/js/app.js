// app-2x2.js — robust loader + clean 2×2 layout

const LOCAL_DATA = "./samples.json";
const FALLBACK_DATA = "https://static.bc-edx.com/data/dl-1-2/m14/lms/starter/samples.json";

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
  location:"Location", bbtype:"BB Type", wfreq:"Wash Freq (wk)"
}[k] || k.replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase()));

function showDataError(msg) {
  const panel = d3.select("#sample-metadata");
  if (!panel.empty()) panel.html(`<div class="text-danger">${msg}</div>`);
}

function renderMetadata(meta) {
  const panel = d3.select("#sample-metadata");
  if (panel.empty()) return;
  panel.html("");
  const table = panel.append("table").attr("class","table table-sm mb-0");
  const tbody = table.append("tbody");
  Object.entries(meta).forEach(([k,v])=>{
    const tr = tbody.append("tr");
    tr.append("th").attr("scope","row").style("width","48%").text(prettyKey(k));
    tr.append("td").text(v ?? "—");
  });
}

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
    width: 0.55,                 // slimmer bars
    marker: { color: "rgba(34,102,204,0.92)", line:{ color:"rgba(34,102,204,0.35)", width:1 } },
    hovertemplate: "%{y}<br>Value: %{x}<extra></extra>"
  };

  const layout = {
    ...THEME,
    title: "",
    margin: { t: 8, r: 12, b: 36, l: 100 },
    xaxis: { title:"Sample Values", gridcolor:"#f2f4f6", zeroline:false, automargin:true },
    yaxis: { title:"OTU IDs",       gridcolor:"#ffffff", automargin:true },
    bargap: 0.28,                   // more spacing between bars
    bargroupgap: 0.1
  };

  Plotly.react(el, [trace], layout, PLOT_CONFIG);
}

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
      color: x, colorscale: "Turbo", showscale: true, opacity: 0.9,      // distinct from gauge
      line: { width: 0.5, color: "rgba(0,0,0,0.12)" },
      colorbar: { thickness: 10, outlinewidth: 0 }
    },
    hovertemplate: "OTU %{x}<br>Value: %{y}<extra></extra>"
  };

  const layout = {
    ...THEME,
    title: "",
    margin: { t: 8, r: 28, b: 46, l: 60 },
    xaxis: { title:"OTU IDs", gridcolor:"#f2f4f6", zeroline:false, automargin:true },
    yaxis: { title:"Sample Values", gridcolor:"#f2f4f6", zeroline:false, automargin:true }
  };

  Plotly.react(el, [trace], layout, PLOT_CONFIG);
}

function renderGauge(wfreqRaw) {
  const el = byId("gauge"); if (!el) return;
  const wfreq = (typeof wfreqRaw === "number" && isFinite(wfreqRaw)) ? wfreqRaw : 0;

  const data = [{
    type: "indicator",
    mode: "gauge+number",
    value: wfreq,
    number: { font: { size: 18 } },
    gauge: {
      axis: { range: [0,9], tickwidth: 1, tickcolor: "#9aa4b2" },
      bar: { color: "#00897b" },  // teal, distinct from bar/bubble
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

  const layout = { ...THEME, margin: { t:8, r:12, b:8, l:12 }, title:"" };
  Plotly.react(el, data, layout, PLOT_CONFIG);
}

function updateCharts(id) {
  if (!DATA) return;
  const s = (DATA.samples||[]).find(x=>x.id===id);
  const m = (DATA.metadata||[]).find(x=>x.id===parseInt(id,10));
  if (!s || !m) return;
  renderMetadata(m);
  renderBar(s);
  renderBubble(s);
  renderGauge(m.wfreq);
}

async function loadDataWithFallback() {
  // Try local, then fallback
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

(async function init(){
  if (typeof d3 === "undefined" || typeof Plotly === "undefined") {
    console.error("D3 or Plotly not loaded. Check script order.");
    showDataError("Libraries failed to load.");
    return;
  }

  DATA = await loadDataWithFallback();
  if (!DATA) {
    showDataError("Failed to load dataset (samples.json). Check file path or GitHub Pages URL.");
    return;
  }

  // Populate dropdown
  const sel = d3.select("#selDataset");
  const names = Array.isArray(DATA.names) ? DATA.names : [];
  names.forEach(id => sel.append("option").text(id).property("value", id));

  if (names.length) updateCharts(names[0]);
  sel.on("change", ()=> updateCharts(sel.property("value")));

  // Debounced resize
  let raf=null;
  window.addEventListener("resize", ()=>{
    if (raf) return;
    raf = requestAnimationFrame(()=>{
      ["bar","bubble","gauge"].forEach(id=>{
        const el = byId(id);
        if (el && Plotly?.Plots) Plotly.Plots.resize(el);
      });
      raf=null;
    });
  });
})();
