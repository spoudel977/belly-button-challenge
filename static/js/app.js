// Read data from samples.json
d3.json("https://static.bc-edx.com/data/dl-1-2/m14/lms/starter/samples.json")
  .then(function(response) {
    // Create a dropdown menu with Test Subject IDs
    const dropdown = d3.select("#selDataset");
    const ids = response.names;
    ids.forEach(id => {
      dropdown.append("option").text(id).property("value", id);
    });

    // Function to update charts and display sample metadata based on selected Test Subject ID
    function updateCharts(selectedId) {
      const sample = response.samples.find(sample => sample.id === selectedId);
      const metadata = response.metadata.find(metadata => metadata.id === parseInt(selectedId));

      // Display sample metadata in a table
      const metadataPanel = d3.select("#sample-metadata");
      metadataPanel.html(""); // Clear previous metadata

      const table = metadataPanel.append("table").style("font-size", "12px");
      const tbody = table.append("tbody");

      // Append data rows
      Object.entries(metadata).forEach(([key, value]) => {
        const row = tbody.append("tr");
        row.append("td").text(key);
        row.append("td").text(value);
      });

      // Extract required data for the bar chart
      const otuIdsBar = sample.otu_ids;
      const otuLabelsBar = sample.otu_labels;
      const sampleValuesBar = sample.sample_values;

      // Get the top 10 OTU IDs, labels, and sample values for the bar chart
      const top10OtuIds = otuIdsBar.slice(0, 10).reverse();
      const top10OtuLabels = otuLabelsBar.slice(0, 10).reverse();
      const top10SampleValues = sampleValuesBar.slice(0, 10).reverse();

      // Create a data array for the bar chart with the top 10 OTU IDs
      const traceBar = {
        x: top10SampleValues,
        y: top10OtuIds.map(id => `OTU ${id}`),
        text: top10OtuLabels,
        type: 'bar',
        orientation: 'h'
      };
      const dataBar = [traceBar];

      // Define the layout for the bar chart
      const layoutBar = {
        title: `Top 10 OTUs Found for Test Subject ${selectedId}`,
        xaxis: { title: 'Sample Values' },
        yaxis: { title: 'OTU IDs' }
      };

      // Plot the bar chart using Plotly
      Plotly.newPlot('bar', dataBar, layoutBar);

      // Extract required data for the bubble chart
      const otuIds = sample.otu_ids;
      const otuLabels = sample.otu_labels;
      const sampleValues = sample.sample_values;

      // Create a data array for the bubble chart
      const traceBubble = {
        x: otuIds,
        y: sampleValues,
        mode: 'markers',
        marker: {
          size: sampleValues,
          color: otuIds,
          colorscale: 'Earth',
          showscale: true
        },
        text: otuLabels
      };
      const dataBubble = [traceBubble];

      // Define the layout for the bubble chart
      const layoutBubble = {
        title: `Bubble Chart for Test Subject ${selectedId}`,
        xaxis: { title: 'OTU IDs' },
        yaxis: { title: 'Sample Values' }
      };

      // Plot the bubble chart using Plotly
      Plotly.newPlot('bubble', dataBubble, layoutBubble);

      // Extract washing frequency for the gauge chart
      const washingFreq = metadata.wfreq;

      // Create a data array for the gauge chart
      const dataGauge = [
        {
          type: "indicator",
          mode: "gauge+number+delta",
          value: washingFreq,
          title: { text: "Weekly Washing Frequency", font: { size: 20 } },
          gauge: {
            axis: { range: [0, 9], tickwidth: 1, tickcolor: "darkblue" },
            bar: { color: "darkblue" },
            bgcolor: "white",
            borderwidth: 2,
            bordercolor: "gray",
            steps: [
              { range: [0, 1], color: "rgba(0, 128, 0, .5)" },
              { range: [1, 2], color: "rgba(0, 128, 0, .6)" },
              { range: [2, 3], color: "rgba(0, 128, 0, .7)" },
              { range: [3, 4], color: "rgba(0, 128, 0, .8)" },
              { range: [4, 5], color: "rgba(0, 128, 0, .9)" },
              { range: [5, 6], color: "rgba(0, 128, 0, 1)" },
              { range: [6, 7], color: "rgba(0, 255, 0, 1)" },
              { range: [7, 8], color: "rgba(100, 255, 0, 1)" },
              { range: [8, 9], color: "rgba(255, 255, 0, 1)" }
            ],
            threshold: {
              line: { color: "red", width: 4 },
              thickness: 0.75,
              value: washingFreq
            }
          }
        }
      ];

      // Define the layout for the gauge chart
      const layoutGauge = { width: 300, height: 300, margin: { t: 25, r: 25, l: 25, b: 25 } };

      // Plot the gauge chart using Plotly
      Plotly.newPlot('gauge', dataGauge, layoutGauge);
    }

    // Call updateCharts function with the default Test Subject ID
    updateCharts(ids[0]);

    // Event listener for dropdown change
    dropdown.on("change", function() {
      const selectedId = dropdown.property("value");
      updateCharts(selectedId);
    });
  })
  .catch(function(error) {
    console.log("Error loading the data: " + error);
  });
