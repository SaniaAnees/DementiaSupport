// API wrapper — talks to Express backend
const API = {
  baseUrl: '',

  getToken() {
    return localStorage.getItem('mc_token');
  },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(this.baseUrl + path, options);
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('mc_token');
      window.app?.showAuthGate();
      throw new Error('Unauthorized');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },

  // Auth
  sendOtp(phone) { return this.post('/api/auth/otp/send', { phone }); },
  verifyOtp(phone, otp) { return this.post('/api/auth/otp/verify', { phone, otp }); },
  setPin(pin) { return this.post('/api/auth/pin/set', { pin }); },
  verifyPin(pin) { return this.post('/api/auth/pin/verify', { pin }); },
  getMe() { return this.get('/api/auth/me'); },
  updateMe(data) { return this.put('/api/auth/me', data); },
  logout() { return this.post('/api/auth/logout'); },

  // Patients
  getPatients() { return this.get('/api/patients'); },
  createPatient(data) { return this.post('/api/patients', data); },
  getPatient(id) { return this.get(`/api/patients/${id}`); },
  updatePatient(id, data) { return this.put(`/api/patients/${id}`, data); },
  deletePatient(id) { return this.request('DELETE', `/api/patients/${id}`); },

  // Memories
  getMemories(patientId) { return this.get(`/api/patients/${patientId}/memories`); },
  addMemory(patientId, data) { return this.post(`/api/patients/${patientId}/memories`, data); },
  deleteMemory(patientId, memoryId) {
    return this.request('DELETE', `/api/patients/${patientId}/memories/${memoryId}`);
  },

  // Sessions
  startSession(patientId, sessionType) { return this.post('/api/sessions', { patientId, sessionType }); },
  completeSession(id, responses, domains) {
    return this.post(`/api/sessions/${id}/complete`, { responses, domains });
  },
  getPatientSessions(patientId, days = 90) {
    return this.get(`/api/sessions?patientId=${encodeURIComponent(patientId)}&days=${days}`);
  },

  // Sync
  sync(items) { return this.post('/api/sync', { items }); },

  // Analytics
  getAnalytics(patientId, days = 30) { return this.get(`/api/analytics/${patientId}?days=${days}`); },

  speechStatus() { return this.get('/api/speech/status'); },
  speechStt(payload) { return this.post('/api/speech/stt', payload); },
};
