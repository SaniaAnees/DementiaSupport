require('dotenv').config();
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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/speech', speechRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

async function start() {
  const engine = await db.ready();
  app.listen(PORT, () => {
    console.log(`MindCare server running on port ${PORT}`);
    console.log(`Demo mode: ${process.env.DEMO_MODE === 'true' ? 'ON' : 'OFF'}`);
    console.log(`DB engine: ${engine}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
