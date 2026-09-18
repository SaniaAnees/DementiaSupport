const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Cloud STT proxy placeholder.
 * Client never holds speech API keys. Configure SPEECH_PROVIDER later
 * (e.g. Google / Azure) and accept audio blobs here.
 */
router.post('/stt', authMiddleware, (req, res) => {
  if (!process.env.SPEECH_PROVIDER) {
    return res.status(501).json({
      error: 'Speech provider not configured',
      transcript: null,
    });
  }
  // Future: decode req.body.audio, call provider, return { transcript }
  return res.status(501).json({
    error: 'Speech STT not implemented for this provider yet',
    transcript: null,
  });
});

module.exports = router;
