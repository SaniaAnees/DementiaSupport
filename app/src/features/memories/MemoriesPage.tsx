import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BrandMark, BackLink, Button, Field, PageHeader, Panel } from '../../shared/ui';
import { db, enqueueSync, nid, now } from '../../shared/db';
import {
  RELATION_CHIPS,
  type Memory,
  type MemoryCategory,
  type RelationChip,
} from '../../shared/types';

const MIN_MEMORIES = 3;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MemoriesPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const setup = params.get('setup') === '1';
  const nav = useNavigate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [relation, setRelation] = useState<RelationChip>('daughter');
  const [aliases, setAliases] = useState('');
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function load() {
    if (!id) return;
    setMemories(await db.memories.where('patientId').equals(id).sortBy('sortOrder'));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function toggleVoice() {
    if (recording && mediaRef.current) {
      mediaRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => setVoiceUri(String(reader.result));
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => {
        if (mediaRef.current?.state === 'recording') {
          mediaRef.current.stop();
          setRecording(false);
        }
      }, 5000);
    } catch {
      alert('Microphone unavailable — use relation chips and a typed label instead.');
    }
  }

  async function add() {
    if (!id || !preview || !caption.trim() || !shortLabel.trim()) {
      alert('Photo, caption, and short label are required.');
      return;
    }
    if (memories.length >= 30) {
      alert('Library cap is 30 photos for this release.');
      return;
    }
    const ts = now();
    const category: MemoryCategory =
      relation === 'home' || relation === 'temple' ? 'place' : relation === 'custom' ? 'object' : 'person';
    const row: Memory = {
      id: nid(),
      patientId: id,
      localUri: preview,
      thumbnailUri: preview,
      caption: caption.trim(),
      shortLabel: shortLabel.trim(),
      relation,
      aliases: aliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      category,
      voiceLabelUri: voiceUri || undefined,
      sortOrder: memories.length,
      createdAt: ts,
      updatedAt: ts,
      syncStatus: 'pending',
    };
    await db.memories.put(row);
    await enqueueSync('memory', row.id, row);
    setPreview(null);
    setCaption('');
    setShortLabel('');
    setAliases('');
    setVoiceUri(null);
    await load();
  }

  const ready = memories.length >= MIN_MEMORIES;

  return (
    <div className="app-shell page-pad">
      {!setup && <BackLink onClick={() => nav('/')} label="Home" />}
      <BrandMark />
      <div style={{ height: 18 }} />
      <PageHeader
        eyebrow={setup ? 'Step 3 of 3 · Memories' : 'Library'}
        title="Family photos"
        lede="Real people and places from their life. Sessions use only this library."
      />
      <Panel style={{ padding: 14, marginBottom: 14 }}>
        <strong>
          {memories.length} / {MIN_MEMORIES} minimum
        </strong>
        <p style={{ margin: '6px 0 0', color: 'var(--ink-secondary)', fontSize: 14 }}>
          Add at least {MIN_MEMORIES} photos before patient sessions. Up to 30 supported.
        </p>
      </Panel>

      <Panel>
        <label
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 160,
            borderRadius: 16,
            border: '1.5px dashed var(--line)',
            cursor: 'pointer',
            overflow: 'hidden',
            background: 'var(--fog-deep)',
          }}
        >
          {preview ? (
            <img src={preview} alt="" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
          ) : (
            <span style={{ color: 'var(--ink-soft)' }}>Tap to choose a photo from this phone</span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setPreview(await fileToDataUrl(file));
            }}
          />
        </label>
        <div style={{ height: 12 }} />
        <Field label="Caption (spoken in warm-up)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <Field label="Short name / label" value={shortLabel} onChange={(e) => setShortLabel(e.target.value)} />
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>Relation</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {RELATION_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setRelation(c)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 999,
                  border: relation === c ? 'none' : '1px solid var(--line)',
                  background: relation === c ? 'var(--teal)' : 'transparent',
                  color: relation === c ? '#fff' : 'var(--ink)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="Aliases (comma-separated)" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        <Button variant="secondary" onClick={toggleVoice}>
          {recording ? 'Stop voice label' : voiceUri ? 'Re-record 5s voice label' : 'Record 5s voice label (optional)'}
        </Button>
        {voiceUri && <audio controls src={voiceUri} style={{ width: '100%', marginTop: 10 }} />}
        <Button onClick={add} style={{ marginTop: 10 }}>
          Save photo to library
        </Button>
      </Panel>

      {setup && (
        <Button
          style={{ marginTop: 16 }}
          disabled={!ready}
          onClick={async () => {
            await db.meta.put({ key: 'onboarding_complete', value: '1' });
            nav('/', { replace: true });
          }}
        >
          {ready ? 'Finish setup — go to caregiver home' : `Add ${MIN_MEMORIES - memories.length} more photo(s)`}
        </Button>
      )}

      <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
        {memories.map((m) => (
          <Panel key={m.id} style={{ padding: 0, overflow: 'hidden' }}>
            <img
              src={m.thumbnailUri || m.localUri}
              alt={m.shortLabel}
              style={{ width: '100%', height: 160, objectFit: 'cover' }}
            />
            <div style={{ padding: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>
                {m.shortLabel}{' '}
                <span style={{ fontSize: 14, color: 'var(--ink-soft)', textTransform: 'capitalize' }}>
                  · {m.relation}
                </span>
              </div>
              <p style={{ color: 'var(--ink-soft)', margin: '6px 0' }}>{m.caption}</p>
              {m.voiceLabelUri && <audio controls src={m.voiceLabelUri} style={{ width: '100%' }} />}
              <Button
                variant="ghost"
                onClick={async () => {
                  await db.memories.delete(m.id);
                  await enqueueSync('memory', m.id, { id: m.id }, 'delete');
                  await load();
                }}
              >
                Remove
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
