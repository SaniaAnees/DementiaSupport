// Patient editor + memory upload
const PatientEditor = {
  currentPatient: null,

  async render(patient) {
    this.currentPatient = patient;
    const content = document.getElementById('patient-detail');
    if (!content) return;

    if (!patient) {
      content.innerHTML = this.renderEditor(null);
      return;
    }

    // Load memories
    let memories = [];
    if (navigator.onLine) {
      try { memories = await API.getMemories(patient.id); } catch {}
    }
    memories = memories.length ? memories : await LocalDB.getAllByIndex('memories', 'patientId', patient.id);

    content.innerHTML = this.renderEditor(patient) + this.renderMemories(memories, patient);
    this.bindEditorEvents();
  },

  renderEditor(patient) {
    const isNew = !patient;
    return `
      <div class="card">
        <h2>${isNew ? 'Add Patient' : 'Edit Patient'}</h2>
        <div class="input-group">
          <label>Full Name *</label>
          <input type="text" id="patient-name" value="${patient?.full_name || patient?.fullName || ''}" placeholder="e.g. Anjali Devi">
        </div>
        <div class="input-group">
          <label>Preferred Name</label>
          <input type="text" id="patient-preferred" value="${patient?.preferred_name || patient?.preferredName || ''}" placeholder="e.g. Anjali">
        </div>
        <div class="input-group">
          <label>Age</label>
          <input type="number" id="patient-age" value="${patient?.age || ''}" placeholder="72">
        </div>
        <div class="input-group">
          <label>Hometown</label>
          <input type="text" id="patient-hometown" value="${patient?.hometown || ''}" placeholder="Imphal">
        </div>
        <div class="input-group">
          <label>Dementia Notes</label>
          <textarea id="patient-notes" rows="3">${patient?.dementia_notes || patient?.dementiaNotes || ''}</textarea>
        </div>
        <div style="display: flex; gap: var(--space-md);">
          <button id="save-patient-btn" class="btn btn-primary btn-block">${isNew ? 'Add' : 'Save'} Patient</button>
        </div>
      </div>
    `;
  },

  renderMemories(memories, patient) {
    return `
      <div class="card">
        <h3>Memory Photos</h3>
        <input type="file" id="memory-image-input" accept="image/*" capture="environment" style="display:none">
        <button id="add-memory-btn" class="btn btn-secondary" style="margin-bottom: var(--space-md);">
          + Add Memory
        </button>
        <div class="memory-grid">
          ${memories.map((m) => `
            <div class="memory-item">
              <img src="${m.image_url || m.imageUrl || m.localUri}" alt="${m.caption}">
              <div class="caption">${m.short_label || m.shortLabel}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  bindEditorEvents() {
    document.getElementById('save-patient-btn')?.addEventListener('click', () => {
      this.savePatient();
    });

    document.getElementById('add-memory-btn')?.addEventListener('click', () => {
      document.getElementById('memory-image-input').click();
    });

    const imgInput = document.getElementById('memory-image-input');
    if (imgInput) {
      imgInput.addEventListener('change', (e) => {
        this.handleMemoryUpload(e.target.files[0]);
      });
    }
  },

  async savePatient() {
    const data = {
      fullName: document.getElementById('patient-name').value,
      preferredName: document.getElementById('patient-preferred').value,
      age: parseInt(document.getElementById('patient-age').value) || null,
      hometown: document.getElementById('patient-hometown').value,
      languageCode: 'en-IN',
      dementiaNotes: document.getElementById('patient-notes').value,
    };

    try {
      if (this.currentPatient) {
        const updated = await API.updatePatient(this.currentPatient.id, data);
        await LocalDB.put('patients', updated);
      } else {
        const created = await API.createPatient(data);
        await LocalDB.put('patients', created);
        this.currentPatient = created;
      }

      CaregiverHome.render();
      const evt = new CustomEvent('patientSaved', { detail: this.currentPatient });
      window.dispatchEvent(evt);
    } catch (err) {
      // Offline — save locally
      if (!this.currentPatient || !this.currentPatient.id) {
        this.currentPatient = { ...data, id: crypto.randomUUID(), caregiverId: 'local' };
        await LocalDB.put('patients', this.currentPatient);
      } else {
        const updated = { ...this.currentPatient, ...data };
        await LocalDB.put('patients', updated);
        this.currentPatient = updated;
      }
      CaregiverHome.render();
    }
  },

  async handleMemoryUpload(file) {
    if (!file || !this.currentPatient) return;

    const dataUrl = await this.readFileAsDataURL(file);
    const memory = {
      id: crypto.randomUUID(),
      patientId: this.currentPatient.id,
      caption: 'This is your...',
      shortLabel: '',
      aliases: [],
      category: 'person',
      relation: 'custom',
      imageUrl: dataUrl,
      sortOrder: 0,
    };

    // Show editor
    const editor = document.createElement('div');
    editor.className = 'card';
    editor.innerHTML = `
      <img src="${dataUrl}" style="max-width:100%; border-radius:12px; margin-bottom:16px;">
      <div class="input-group">
        <label>Caption (e.g. "This is your daughter, Meera")</label>
        <input type="text" class="mem-caption" placeholder="Caption">
      </div>
      <div class="input-group">
        <label>Name to recognize (e.g. "Meera")</label>
        <input type="text" class="mem-name" placeholder="Short label">
      </div>
      <div class="input-group">
        <label>Aliases (comma separated)</label>
        <input type="text" class="mem-aliases" placeholder="beti, daughter">
      </div>
      <div style="display:flex; gap:var(--space-md);">
        <button class="btn btn-primary btn-block save-memory">Save</button>
        <button class="btn btn-text cancel-memory">Cancel</button>
      </div>
    `;

    const memGrid = document.querySelector('.memory-grid');
    memGrid.parentNode.insertBefore(editor, memGrid);

    editor.querySelector('.save-memory').addEventListener('click', async () => {
      const caption = editor.querySelector('.mem-caption').value;
      const shortLabel = editor.querySelector('.mem-name').value;
      const aliases = editor.querySelector('.mem-aliases').value.split(',').map((s) => s.trim()).filter(Boolean);

      memory.caption = caption;
      memory.shortLabel = shortLabel;
      memory.aliases = aliases;

      await LocalDB.put('memories', memory);
      editor.remove();
      this.render(this.currentPatient);
    });

    editor.querySelector('.cancel-memory').addEventListener('click', () => {
      editor.remove();
    });
  },

  readFileAsDataURL(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },
};
