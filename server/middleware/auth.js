const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mindcare-dev-secret-change-in-production';

function signToken(caregiver) {
  return jwt.sign(
    { cid: caregiver.id, tv: caregiver.token_version },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.caregiverId = decoded.cid;
  next();
}

module.exports = { signToken, verifyToken, authMiddleware, JWT_SECRET };
