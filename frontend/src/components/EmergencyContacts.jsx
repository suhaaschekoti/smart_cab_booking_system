import { useState, useEffect, useCallback } from "react";
import { getContacts, addContact, deleteContact } from "../api/emergency";

const EMPTY = { contact_name: "", contact_phone: "", contact_email: "", relation: "" };

export default function EmergencyContacts({ token, compact }) {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try { setContacts(await getContacts(token)); } catch { /* ignore */ }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      await addContact(token, { ...form, contact_email: form.contact_email || null, relation: form.relation || null });
      setForm(EMPTY); setShowForm(false); load();
    } catch (err) { setError(err?.response?.data?.detail || "Could not add contact."); }
    finally { setSaving(false); }
  }
  async function remove(id) { try { await deleteContact(token, id); load(); } catch { /* ignore */ } }

  return (
    <div>
      {contacts.length === 0 && !showForm && (
        <p className="empty-state">No emergency contacts yet. Add at least one so the SOS button can notify someone.</p>
      )}
      {contacts.length > 0 && (
        <div className="contact-list">
          {contacts.map((c) => (
            <div key={c.contact_id} className="contact-item">
              <div>
                <div className="contact-name">{c.contact_name} {c.relation && <span className="contact-rel">· {c.relation}</span>}</div>
                <div className="contact-meta">{c.contact_phone}{c.contact_email && ` · ${c.contact_email}`}{!c.contact_email && <span className="contact-warn"> · no email — won't receive alerts</span>}</div>
              </div>
              <button className="cancel-link" onClick={() => remove(c.contact_id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {!showForm ? (
        contacts.length < 5 && <button className="rate-btn" style={{ marginTop: 10 }} onClick={() => setShowForm(true)}>+ Add contact</button>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 14 }}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-grid">
            <div className="field"><label>Name</label><input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required /></div>
            <div className="field"><label>Relation</label><input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Parent, friend…" /></div>
            <div className="field"><label>Phone</label><input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} required /></div>
            <div className="field"><label>Email (for alerts)</label><input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="Required to receive SOS emails" /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="submit-btn" type="submit" disabled={saving} style={{ marginTop: 0 }}>{saving ? "Saving…" : "Save contact"}</button>
            <button type="button" className="logout-btn-small" onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}