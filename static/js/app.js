// Read data from samples.json
d3.json("https://static.bc-edx.com/data/dl-1-2/m14/lms/starter/samples.json")
  .then(function (response) {
    // Create a dropdown menu with Test Subject IDs
    const dropdown = d3.select("#selDataset");
    const ids = response.names || [];
    ids.forEach(id => dropdown.append("option").text(id).property("value", id));

    // Reusable Plotly config/theme
    const PLOT_CONFIG = { responsive: true, displayModeBar: false };
    const THEME = {
      font: { family: "Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12, color: "#2d2d2d" },
      paper_bgcolor: "rgba(0,0,0,0)",   // transparent (let card/bg show)
      plot_bgcolor: "#ffffff"
    };

    // Function to update charts and display sample metadata based on selected Test Subject ID
    function updateCharts(selectedId) {
      const sample   = (response.samples || []).find(s => s.id === selectedId);
      const metadata = (response.metadata || []).find(m => m.id === parseInt(selectedId, 10));
      if (!sample || !metadata) return;

      // ---- Demographic table ----
      const metadataPanel = d3.select("#sample-metadata");
      metadataPanel.html(""); // Clear previous metadata
      const table = metadataPanel.append("table").attr("class", "table table-sm mb-0");
      const tbody = table.append("tbody");
      Object.entries(metadata).forEach(([key, value]) => {
        const row = tbody.append("tr");
        row.append("th").attr("scope", "row").style("width","45%").text(prettyKey(key));
        row.append("td").text(value ?? "—");
      });

      // ---- BAR: true top 10 (sorted) ----
      const vals   = sample.sample_values || [];
      const idsBar = sample.otu_ids || [];
      const lbls   = sample.otu_labels || [];

      const top10 = vals.map((v, i) => ({ v, id: idsBar[i], label: lbls[i] }))
                        .sort((a, b) => b.v - a.v)
                        .slice(0, 10)
                        .reverse(); // largest at top in horiz bar

      const traceBar = {
        x: top10.map(d => d.v),
        y: top10.map(d => `OTU ${d.id}`),
        text: top10.map(d => d.label),
        type: "bar",
        orientation: "h",
        marker: { color: "#2266cc" },
        hovertemplate: "%{y}<br>Value: %{x}<extra></extra>"
      };
      const layoutBar = {
        ...THEME,
        // Title kept minimal (or set to "" if your card already has a title)
        title: "", // `Top 10 OTUs — ID ${selectedId}`
        margin: { t: 10, r: 10, b: 40, l: 70 },
        xaxis: { title: "Sample Values", gridcolor: "#f0f0f0", zeroline: false, automargin: true },
        yaxis: { title: "OTU IDs",     gridcolor: "#ffffff", zeroline: false, automargin: true }
      };
      Plotly.react("bar", [traceBar], layoutBar, PLOT_CONFIG);

      // ---- BUBBLE ----
      const xAll = sample.otu_ids || [];
      const yAll = sample.sample_values || [];
      const tAll = sample.otu_labels || [];
      const maxVal = yAll.length ? Math.max(...yAll) : 0;
      const sizeref = maxVal ? maxVal / 70 : 1;

      const traceBubble = {
        x: xAll, y: yAll, text: tAll, mode: "markers",
        marker: {
          size: yAll, sizemode: "area", sizeref,
          color: xAll, colorscale: "Viridis", showscale: true, opacity: 0.85,
          line: { width: 0.5, color: "rgba(0,0,0,0.15)" },
          colorbar: { thickness: 12, outlinewidth: 0 }
        },
        hovertemplate: "OTU %{x}<br>Value: %{y}<extra></extra>"
      };
      const layoutBubble = {
        ...THEME,
        title: "",
        margin: { t: 10, r: 20, b: 50, l: 60 },
        xaxis: { title: "OTU IDs",     gridcolor: "#f0f0f0", zeroline: false, automargin: true },
        yaxis: { title: "Sample Values", gridcolor: "#f0f0f0", zeroline: false, automargin: true }
      };
      Plotly.react("bubble", [traceBubble], layoutBubble, PLOT_CONFIG);

      // ---- GAUGE ----
      const wfreq = Number.isFinite(metadata.wfreq) ? metadata.wfreq : 0;
      const dataGauge = [{
        type: "indicator",
        mode: "gauge+number",
        value: wfreq,
        number: { font: { size: 20 } },
        title: { text: "", font: { size: 16 } },
        gauge: {
          axis: { range: [0, 9], tickwidth: 1, tickcolor: "#708090" },
          bar: { color: "#2266cc" },
          bgcolor: "#ffffff",
          borderwidth: 0,
          steps: [
            { range: [0, 3], color: "#e8f5e9" },
            { range: [3, 6], color: "#c8e6c9" },
            { range: [6, 9], color: "#a5d6a7" }
          ],
          threshold: { line: { color: "#d32f2f", width: 3 }, thickness: 0.75, value: wfreq }
        }
      }];
      const layoutGauge = { ...THEME, margin: { t: 10, r: 10, b: 20, l: 10 } };
      Plotly.react("gauge", dataGauge, layoutGauge, PLOT_CONFIG);
    }

    // Call updateCharts function with the default Test Subject ID
    if (ids.length) updateCharts(ids[0]);

    // Event listener for dropdown change
    dropdown.on("change", function () {
      const selectedId = dropdown.property("value");
      updateCharts(selectedId);
    });

    // Optional: make Plotly recalc on resize (helps one-screen layout)
    window.addEventListener("resize", () => {
      ["bar", "bubble", "gauge"].forEach(id => {
        const el = document.getElementById(id);
        if (el && window.Plotly && Plotly.Plots) Plotly.Plots.resize(el);
      });
    });

    // Helper for nicer metadata keys
    function prettyKey(k) {
      const m = { id: "ID", ethnicity: "Ethnicity", gender: "Gender", age: "Age", location: "Location", bbtype: "BB Type", wfreq: "Wash Freq (wk)" };
      return m[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  })
  .catch(function (error) {
    console.log("Error loading the data:", error);
    d3.select("#sample-metadata").html('<div class="text-danger">Failed to load data.</div>');
  });
