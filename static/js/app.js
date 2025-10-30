const DATA_URL = "./samples.json";

const PLOT_CONFIG = { responsive: true, displayModeBar: false };

const THEME = {
  font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#2d2d2d" },
  hoverlabel: {
    bgcolor: "#ffffff",
    bordercolor: "#333",
    font: { size: 14, color: "#111" }
  },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "#ffffff"
};

let DATA = null;

function prettyKey(k) {
  const map = { id:"ID", ethnicity:"Ethnicity", gender:"Gender", age:"Age", location:"Location", bbtype:"BB Type", wfreq:"Wash Freq (wk)" };
  return map[k] || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

function renderMetadata(meta) {
  const panel = d3.select("#sample-metadata");
  panel.html("");
  const table = panel.append("table").attr("class","table table-sm mb-0");
  const tbody = table.append("tbody");
  Object.entries(meta).forEach(([k,v])=>{
    const row = tbody.append("tr");
    row.append("th").text(prettyKey(k));
    row.append("td").text(v ?? "—");
  });
}

function renderBar(sample) {
  const trace = {
    x: sample.sample_values.slice(0,10).reverse(),
    y: sample.otu_ids.slice(0,10).map(id=>`OTU ${id}`).reverse(),
    type: "bar",
    orientation: "h",
    marker: { color: "#1f77b4" },
    hovertemplate: "%{y}<br>Value: %{x}<extra></extra>"
  };

  const layout = {
    ...THEME,
    margin: { t:10, r:10, b:40, l:90 }
  };

  Plotly.newPlot("bar", [trace], layout, PLOT_CONFIG);
}

function renderBubble(sample) {
  const el = document.getElementById("bubble");

  const baseSizes = sample.sample_values.map(v => v * 0.15);

  const trace = {
    x: sample.otu_ids,
    y: sample.sample_values,
    text: sample.otu_labels,
    mode: "markers",
    marker: {
      size: baseSizes,
      sizemode: "area",
      color: sample.otu_ids,
      colorscale: "Turbo",
      opacity: 0.9,
      line: { width: 0.5, color: "rgba(0,0,0,0.15)" }
    },
    hovertemplate:
      "<b>OTU %{x}</b><br>" +
      "Value: %{y}<br>" +
      "<span style='font-size:11px;color:#555;'>%{text}</span><extra></extra>"
  };

  const layout = {
    ...THEME,
    margin: { t:10, r:40, b:50, l:60 },
    xaxis: { title:"OTU IDs", gridcolor:"#f0f0f0" },
    yaxis: { title:"Sample Values", gridcolor:"#f0f0f0" }
  };

  Plotly.newPlot(el, [trace], layout, PLOT_CONFIG);

  // ✅ Auto enlarge bubbles when zooming
  el.on("plotly_relayout", evt => {
    const xr = evt["xaxis.range[1]"] - evt["xaxis.range[0]"];
    if (!xr) return;

    const zoomFactor = Math.min(8, Math.max(1, 3500 / xr));

    Plotly.restyle(el, {
      "marker.size": baseSizes.map(s => s * zoomFactor)
    });
  });
}

function renderGauge(w) {
  const data = [{
    type: "indicator",
    mode: "gauge+number",
    value: w,
    gauge: {
      axis: { range: [0,9] },
      bar: { color: "#00897b" },
      steps: [
        { range:[0,3], color:"#e0f2f1" },
        { range:[3,6], color:"#c8e6e5" },
        { range:[6,9], color:"#b2dfdb" }
      ]
    }
  }];

  const layout = { ...THEME, margin:{t:10, r:10, b:10, l:10} };
  Plotly.newPlot("gauge", data, layout, PLOT_CONFIG);
}

function updateCharts(id) {
  const s = DATA.samples.find(x=>x.id===id);
  const m = DATA.metadata.find(x=>x.id===parseInt(id));
  renderMetadata(m);
  renderBar(s);
  renderBubble(s);
  renderGauge(m.wfreq);
}

(async function init(){
  DATA = await d3.json(DATA_URL);

  const dropdown = d3.select("#selDataset");
  DATA.names.forEach(id=> dropdown.append("option").text(id).property("value",id));

  updateCharts(DATA.names[0]);
  dropdown.on("change", ()=> updateCharts(dropdown.property("value")));
})();
