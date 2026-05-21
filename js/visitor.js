// js/visitor.js
// Ashish's Note: Tracks user visits for the dashboard statistics. Uses localStorage.

// Utility: Get today's date in YYYY-MM-DD
function getToday() {
  return new Date().toISOString().split("T")[0];
}

// Store visit
function storeVisit() {
  // Ashish's Note: Using localStorage to persist visit count across sessions.
  const visits = JSON.parse(localStorage.getItem("visits") || "{}");
  const today = getToday();
  visits[today] = (visits[today] || 0) + 1;
  localStorage.setItem("visits", JSON.stringify(visits));
}

// Calculate totals
function calculateStats() {
  const visits = JSON.parse(localStorage.getItem("visits") || "{}");
  const today = getToday();
  const now = new Date();
  let todayCount = 0, weekCount = 0, monthCount = 0;

  const chartData = [];

  Object.keys(visits).forEach(date => {
    const visitDate = new Date(date);
    const diffDays = Math.floor((now - visitDate) / (1000 * 60 * 60 * 24));

    if (date === today) todayCount += visits[date];
    if (diffDays <= 7) weekCount += visits[date];
    if (diffDays <= 30) monthCount += visits[date];

    // Ashish's Note: Collect data for the last 7 days for the chart.
    if (diffDays <= 7) {
      chartData.push({ date, count: visits[date] });
    }
  });

  // Ashish's Note: Update the dashboard spans in index.html.
  document.getElementById("todayCount").innerText = todayCount;
  document.getElementById("weekCount").innerText = weekCount;
  document.getElementById("monthCount").innerText = monthCount;

  drawChart(chartData);
}

// Draw pie chart
function drawChart(data) {
  // Ashish's Note: Use Chart.js to visualize last 7 days' activity.
  const ctx = document.getElementById('visitPieChart').getContext('2d');
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: [
          "#FF6384", "#36A2EB", "#FFCE56", "#8AFF8A", "#FFA07A", "#BA55D3", "#87CEFA"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Visits Over Last 7 Days'
        }
      }
    }
  });
}

// Initialize
// Ashish's Note: Runs the tracking and calculation every time the index page loads.
storeVisit();
calculateStats();
