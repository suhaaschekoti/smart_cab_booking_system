import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getSession,
} from "../api/auth";
import { getMyDriverVehicle } from "../api/drivers";
import {
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
} from "../api/emergency";
import { Popover, Button } from "./motion";

const initials = (n = "") =>
  n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const emptyContact = {
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  relation: "",
};

function getErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  return typeof detail === "string" ? detail : fallback;
}

export default function ProfileModal({
  open,
  onClose,
  role,
  onUpdated,
  anchorRef,
}) {
  const session = getSession();

  const [tab, setTab] = useState("details");
  const [me, setMe] = useState(null);
  const [vehicle, setVehicle] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    gender: "",
  });

  const [pw, setPw] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [contacts, setContacts] = useState([]);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!open || !session) return;

    setError("");
    setOk("");
    setTab("details");
    setMe(null);
    setVehicle(null);
    setContacts([]);
    setContactForm(emptyContact);
    setEditingContactId(null);

    getMyProfile(role, session.token)
      .then((p) => {
        setMe(p);
        setForm({
          name: p.name || "",
          phone: p.phone || "",
          gender: p.gender || "",
        });
      })
      .catch(() => setError("Could not load your profile."));

    if (role === "driver") {
      getMyDriverVehicle(session.token)
        .then((v) => setVehicle(v?.[0] || null))
        .catch(() => {});
    }
  }, [open, role, session?.token]);

  useEffect(() => {
    if (!open || role !== "user" || tab !== "emergency" || !session) {
      return;
    }

    let cancelled = false;

    async function loadContacts() {
      setContactsLoading(true);
      setError("");
      setOk("");

      try {
        const data = await getEmergencyContacts(session.token);
        if (!cancelled) setContacts(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(err, "Could not load emergency contacts.")
          );
        }
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [open, role, tab, session?.token]);

  async function saveDetails(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);

    try {
      const payload = {
        name: form.name,
        phone: form.phone,
      };

      if (role === "user") {
        payload.gender = form.gender || null;
      }

      const p = await updateMyProfile(role, session.token, payload);
      setMe(p);
      setOk("Details saved.");
      onUpdated?.(p);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save details."));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (pw.next !== pw.confirm) {
      setError("New passwords don't match.");
      return;
    }

    setBusy(true);

    try {
      await changeMyPassword(
        role,
        session.token,
        pw.current,
        pw.next
      );

      setOk("Password updated.");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Could not update password."));
    } finally {
      setBusy(false);
    }
  }

  function startEditing(contact) {
    setEditingContactId(contact.contact_id);
    setContactForm({
      contact_name: contact.contact_name || "",
      contact_phone: contact.contact_phone || "",
      contact_email: contact.contact_email || "",
      relation: contact.relation || "",
    });
    setError("");
    setOk("");
  }

  function cancelEditing() {
    setEditingContactId(null);
    setContactForm(emptyContact);
    setError("");
    setOk("");
  }

  async function saveContact(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!session?.token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setContactBusy(true);

    const payload = {
      contact_name: contactForm.contact_name.trim(),
      contact_phone: contactForm.contact_phone.trim(),
      contact_email: contactForm.contact_email.trim() || null,
      relation: contactForm.relation.trim() || null,
    };

    try {
      if (editingContactId !== null) {
        const updated = await updateEmergencyContact(
          session.token,
          editingContactId,
          payload
        );

        setContacts((previous) =>
          previous.map((contact) =>
            contact.contact_id === editingContactId
              ? updated
              : contact
          )
        );

        setOk("Emergency contact updated.");
      } else {
        if (contacts.length >= 5) {
          setError("You can save at most 5 emergency contacts.");
          return;
        }

        const created = await addEmergencyContact(
          session.token,
          payload
        );

        setContacts((previous) => [...previous, created]);
        setOk("Emergency contact added.");
      }

      setContactForm(emptyContact);
      setEditingContactId(null);
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not save the emergency contact.")
      );
    } finally {
      setContactBusy(false);
    }
  }

  async function removeContact(contact) {
    const confirmed = window.confirm(
      `Delete emergency contact "${contact.contact_name}"?`
    );

    if (!confirmed) return;

    setError("");
    setOk("");
    setContactBusy(true);

    try {
      await deleteEmergencyContact(
        session.token,
        contact.contact_id
      );

      setContacts((previous) =>
        previous.filter(
          (item) => item.contact_id !== contact.contact_id
        )
      );

      if (editingContactId === contact.contact_id) {
        setEditingContactId(null);
        setContactForm(emptyContact);
      }

      setOk("Emergency contact deleted.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not delete the emergency contact.")
      );
    } finally {
      setContactBusy(false);
    }
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setError("");
    setOk("");
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      width={400}
    >
      <div
        className="modal-header"
        style={{ marginBottom: 12 }}
      >
        <h3 className="modal-title">Your profile</h3>
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {me && (
        <div className="profile-head">
          <div className="avatar avatar-lg">
            {initials(me.name)}
          </div>
          <div>
            <h3>{me.name}</h3>
            <div className="muted">{me.email}</div>
          </div>
        </div>
      )}

      <div className="profile-tabs">
        {[
          ["details", "Details"],
          ["password", "Password"],
          ...(role === "user"
            ? [["emergency", "Emergency Contacts"]]
            : []),
        ].map(([key, label]) => (
          <button
            key={key}
            className={`profile-tab ${tab === key ? "active" : ""}`}
            onClick={() => changeTab(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="error-msg">{error}</div>}
      {ok && <div className="ok-msg">{ok}</div>}

      <AnimatePresence mode="wait" initial={false}>
        {tab === "details" ? (
          <motion.form
            key="details"
            onSubmit={saveDetails}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="field">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
                minLength={2}
              />
            </div>

            <div className="field">
              <label>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                required
                pattern="^\+?[0-9]{10,15}$"
                title="Enter 10 to 15 digits, optionally starting with +."
              />
            </div>

            {role === "user" && (
              <div className="field">
                <label>Gender (optional)</label>
                <input
                  value={form.gender}
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value })
                  }
                />
              </div>
            )}

            {me && (
              <div
                className="kv"
                style={{ margin: "4px 0 18px" }}
              >
                <span>Email</span>
                <span>{me.email}</span>

                {role === "user" && (
                  <>
                    <span>Reward points</span>
                    <span>{me.reward_points}</span>
                  </>
                )}

                {role === "driver" && (
                  <>
                    <span>Licence</span>
                    <span>{me.license_number}</span>
                    <span>Rating</span>
                    <span>★ {Number(me.rating).toFixed(1)}</span>

                    {vehicle && (
                      <>
                        <span>Vehicle</span>
                        <span>
                          {vehicle.vehicle_number}
                          {vehicle.vehicle_type &&
                            `, ${vehicle.vehicle_type}`}
                        </span>
                      </>
                    )}
                  </>
                )}

                <span>Verified</span>
                <span>{me.is_verified ? "Yes" : "No"}</span>

                <span>Member since</span>
                <span>
                  {me.created_at
                    ? new Date(me.created_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            )}

            <Button
              className="btn-block"
              type="submit"
              disabled={busy || !me}
            >
              {busy ? "Saving…" : "Save details"}
            </Button>
          </motion.form>
        ) : tab === "password" ? (
          <motion.form
            key="password"
            onSubmit={savePassword}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="field">
              <label>Current password</label>
              <input
                type="password"
                value={pw.current}
                onChange={(e) =>
                  setPw({ ...pw, current: e.target.value })
                }
                autoComplete="current-password"
                required
              />
            </div>

            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={pw.next}
                onChange={(e) =>
                  setPw({ ...pw, next: e.target.value })
                }
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="field">
              <label>Confirm new password</label>
              <input
                type="password"
                value={pw.confirm}
                onChange={(e) =>
                  setPw({ ...pw, confirm: e.target.value })
                }
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <p className="field-hint">
              At least 8 characters.
            </p>

            <Button
              className="btn-block"
              type="submit"
              disabled={busy}
            >
              {busy ? "Updating…" : "Update password"}
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="emergency"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div style={{ marginBottom: 14 }}>
              <h4 style={{ margin: "4px 0 6px" }}>
                Emergency contacts
              </h4>
              <p className="field-hint">
                Save up to 5 trusted contacts. Contacts with an email
                address can receive your SOS email alerts.
              </p>
              <p className="field-hint">
                {contacts.length} of 5 contacts saved
              </p>
            </div>

            {contactsLoading ? (
              <p className="muted">Loading contacts…</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {contacts.map((contact) => (
                  <div
                    key={contact.contact_id}
                    style={{
                      border: "1px solid var(--border, #ddd)",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong>{contact.contact_name}</strong>
                        {contact.relation && (
                          <div className="muted">
                            {contact.relation}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexShrink: 0,
                        }}
                      >
                        <button
                          type="button"
                          className="profile-tab"
                          disabled={contactBusy}
                          onClick={() => startEditing(contact)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="profile-tab"
                          disabled={contactBusy}
                          onClick={() => removeContact(contact)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        overflowWrap: "anywhere",
                      }}
                    >
                      <div>{contact.contact_phone}</div>
                      {contact.contact_email && (
                        <div className="muted">
                          {contact.contact_email}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {contacts.length === 0 && (
                  <p className="muted">
                    No emergency contacts yet. Add someone you trust
                    below.
                  </p>
                )}
              </div>
            )}

            {(editingContactId !== null || contacts.length < 5) && (
              <form onSubmit={saveContact}>
                <h4 style={{ margin: "8px 0 12px" }}>
                  {editingContactId !== null
                    ? "Edit contact"
                    : "Add a contact"}
                </h4>

                <div className="field">
                  <label>Contact name</label>
                  <input
                    value={contactForm.contact_name}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        contact_name: e.target.value,
                      })
                    }
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Full name"
                  />
                </div>

                <div className="field">
                  <label>Phone number</label>
                  <input
                    type="tel"
                    value={contactForm.contact_phone}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        contact_phone: e.target.value,
                      })
                    }
                    required
                    minLength={10}
                    maxLength={15}
                    pattern="^\+?[0-9]{10,15}$"
                    title="Enter 10 to 15 digits, optionally starting with +."
                    placeholder="e.g. +919876543210"
                  />
                </div>

                <div className="field">
                  <label>Email (optional)</label>
                  <input
                    type="email"
                    value={contactForm.contact_email}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        contact_email: e.target.value,
                      })
                    }
                    maxLength={150}
                    placeholder="contact@example.com"
                  />
                </div>

                <div className="field">
                  <label>Relationship (optional)</label>
                  <input
                    value={contactForm.relation}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        relation: e.target.value,
                      })
                    }
                    maxLength={50}
                    placeholder="e.g. Parent, Friend"
                  />
                </div>

                <Button
                  className="btn-block"
                  type="submit"
                  disabled={contactBusy || contactsLoading}
                >
                  {contactBusy
                    ? "Saving…"
                    : editingContactId !== null
                      ? "Save changes"
                      : "Add emergency contact"}
                </Button>

                {editingContactId !== null && (
                  <button
                    type="button"
                    className="profile-tab"
                    style={{
                      width: "100%",
                      marginTop: 8,
                    }}
                    disabled={contactBusy}
                    onClick={cancelEditing}
                  >
                    Cancel editing
                  </button>
                )}
              </form>
            )}

            {contacts.length >= 5 && editingContactId === null && (
              <p className="field-hint">
                You've reached the five-contact limit. Delete a contact
                before adding another.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Popover>
  );
}
