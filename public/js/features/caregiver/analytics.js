// Analytics rendering helper — uses Chart.js if available
const AnalyticsRender = {
  async render(patientId) {
    try {
      let data;
      if (navigator.onLine) {
        data = await API.getAnalytics(patientId);
      } else {
        data = await this.getLocalAnalytics(patientId);
      }

      const content = document.getElementById('analytics-view');
      if (!content) return;

      const summary = data.summary || { totalSessions: 0, avgAccuracy: 0, avgComposite: 0, avgResponseMs: 0 };
      const trend = data.trend || { state: 'insufficient_data', message: 'No data yet' };
      const trendClass = `trend-${trend.state}`.replace(/_/g, '-');

      content.innerHTML = `
        <div class="analytics-summary">
          <div class="stat-card"><div class="stat-value">${summary.totalSessions}</div><div class="stat-label">Sessions</div></div>
          <div class="stat-card"><div class="stat-value">${Math.round((summary.avgAccuracy || 0) * 100)}%</div><div class="stat-label">Accuracy</div></div>
          <div class="stat-card"><div class="stat-value">${Math.round(summary.avgComposite || 0)}</div><div class="stat-label">Avg Score</div></div>
          <div class="stat-card"><div class="stat-value">${summary.avgResponseMs || 0}ms</div><div class="stat-label">Response</div></div>
        </div>
        <div class="card">
          <span class="trend-badge ${trendClass}">${trend.state.replace('_', ' ')}</span>
          <p>${trend.message}</p>
        </div>
        <div class="card">
          <canvas id="trend-chart" height="200"></canvas>
        </div>
        ${data.flags?.length ? `<div class="card"><h3>Alerts</h3>${this.renderAlerts(data.flags, data.alerts)}</div>` : ''}
      `;

      this.drawChart(data.dailyScores || []);
    } catch (err) {
      console.error('Analytics render error:', err);
    }
  },

  renderAlerts(flags, patientAlerts) {
    const items = flags.map((f) => ({
      severity: f.severity === 'attention' ? 'error' : 'warning',
      title: f.title,
      body: f.body,
    }));
    return `<div class="alert-list">
      ${items.map((a) => `
        <div class="alert-item" style="border-left-color: var(--color-${a.severity})">
          <h4>${a.title}</h4><p>${a.body}</p>
        </div>
      `).join('')}
    </div>`;
  },

  drawChart(dailyScores) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas || !dailyScores.length) return;

    // Load Chart.js dynamically
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => this.drawChart(dailyScores);
      document.head.appendChild(script);
      return;
    }

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyScores.map((d) => d.date),
        datasets: [
          {
            label: 'Accuracy',
            data: dailyScores.map((d) => Math.round(d.accuracy * 100)),
            borderColor: '#4a7c59',
            tension: 0.3,
            fill: false,
            yAxisID: 'y',
          },
          {
            label: 'Composite Score',
            data: dailyScores.map((d) => d.composite),
            borderColor: '#d4856a',
            tension: 0.3,
            fill: false,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: 'Accuracy %' }, suggestedMin: 0, suggestedMax: 100 },
          y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Score' } },
        },
      },
    });
  },

  getLocalAnalytics(patientId) {
    // Same logic as CaregiverHome — simplified
    return {
      summary: { totalSessions: 0 },
      trend: { state: 'insufficient_data', message: 'Need more sessions' },
      dailyScores: [],
    };
  },
};
