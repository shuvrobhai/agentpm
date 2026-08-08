import express from 'express';
import { createDashboardApiRouter } from './src/deploy/dashboard-api.js';
import { renderDashboardHtml } from './src/deploy/dashboard-ui.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());

// Mount Web Dashboard REST API
app.use('/api', createDashboardApiRouter());

// Serve Single-Page Web Dashboard UI
app.use((_req, res) => {
  res.send(renderDashboardHtml());
});

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 AgentPM Web Dashboard & Server running on http://${HOST}:${PORT}`);
});

export { app };