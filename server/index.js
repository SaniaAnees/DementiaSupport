require('dotenv').config();

const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT || 'local';
console.log('MindCare boot: node', process.version, 'port', process.env.PORT || 3000, 'commit', String(commit).slice(0, 7));

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const sessionRoutes = require('./routes/sessions');
const syncRoutes = require('./routes/sync');
const analyticsRoutes = require('./routes/analytics');
const speechRoutes = require('./routes/speech');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '12mb' }));

// Railway / load-balancer probes — must succeed or the service restarts
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, engine: db.getEngine?.() || 'starting' });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/speech', speechRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function start() {
  const engine = await db.ready();
  app.listen(PORT, HOST, () => {
    console.log(`MindCare server listening on http://${HOST}:${PORT}`);
    console.log(`Demo mode: ${process.env.DEMO_MODE === 'true' ? 'ON' : 'OFF'}`);
    console.log(`DB engine: ${engine}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
