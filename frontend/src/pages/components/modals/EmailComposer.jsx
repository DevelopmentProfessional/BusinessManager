import React, { useEffect, useId, useState } from "react";
import { EnvelopeIcon, XMarkIcon } from "../../../icons";
import { emailAPI } from "../../../services/api";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { InputText, InputTextarea } from "../Inputs";
import Field_Floating from "../fields/Field_Floating";

const CONTACT_LABELS = {
  client: "Client",
  supplier: "Supplier",
  employee: "Employee",
  external: "External",
};

const isValidEmail = (email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

function RecipientField({ page, label, recipients, onChange }) {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const inputId = useId();

  useEffect(() => {
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setContacts([]);
      setSearchError("");
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(() => {
      setSearching(true);
      emailAPI.searchContacts(searchTerm, page)
        .then((response) => {
          if (active) setContacts(response?.data?.contacts || []);
        })
        .catch((error) => {
          if (active) {
            setContacts([]);
            setSearchError(error?.response?.data?.detail || error?.message || "Unable to search contacts.");
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [page, query]);

  const appendRecipients = (newRecipients) => {
    const knownEmails = new Set(recipients.map((item) => item.email.toLowerCase()));
    const additions = newRecipients
      .map((recipient) => ({ ...recipient, email: recipient.email.trim().toLowerCase() }))
      .filter((recipient) => isValidEmail(recipient.email) && !knownEmails.has(recipient.email))
      .filter((recipient) => {
        if (knownEmails.has(recipient.email)) return false;
        knownEmails.add(recipient.email);
        return true;
      });
    onChange([...recipients, ...additions]);
  };

  const addRecipient = (recipient) => {
    appendRecipients([recipient]);
    setQuery("");
    setContacts([]);
    setSearchError("");
  };

  const commitManualEmails = (value) => {
    const emails = value.split(";").map((part) => part.trim()).filter(Boolean);
    if (emails.every(isValidEmail)) {
      appendRecipients(emails.map((email) => ({ type: "external", email })));
      setQuery("");
      setContacts([]);
      setSearchError("");
      return true;
    }
    return false;
  };

  const handleChange = (event) => {
    const value = event.target.value;
    if (value.includes(";")) {
      const parts = value.split(";");
      const complete = parts.slice(0, -1).map((part) => part.trim()).filter(Boolean);
      if (complete.every(isValidEmail)) {
        appendRecipients(complete.map((email) => ({ type: "external", email })));
        setQuery(parts.at(-1).trim());
        return;
      }
    }
    setQuery(value);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== ";") return;
    event.preventDefault();
    if (!query.trim()) return;
    if (!commitManualEmails(query)) {
      setSearchError("Enter a valid email address, or choose a contact from the suggestions.");
    }
  };

  return (
    <div>
      <Field_Floating id={inputId} label={label}>
        <InputText
          id={inputId}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder=" "
          autoComplete="off"
        />
      </Field_Floating>
      {recipients.length > 0 && (
        <div className="align-items-center d-flex flex-wrap gap-1 mt-2">
          {recipients.map((recipient, index) => (
            <React.Fragment key={`${recipient.type}:${recipient.id || recipient.email}`}>
              <span className="align-items-center bg-gray-100 dark:bg-gray-700 d-inline-flex gap-1 px-2 py-1 rounded small">
                <span>{recipient.email}</span>
                <span className="badge bg-secondary">{CONTACT_LABELS[recipient.type] || "External"}</span>
                <button
                  type="button"
                  className="btn btn-link p-0 text-muted"
                  aria-label={`Remove ${recipient.email} from ${label}`}
                  onClick={() => onChange(recipients.filter((_, recipientIndex) => recipientIndex !== index))}
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
              {index < recipients.length - 1 && <span aria-hidden="true" className="text-muted">;</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      {(searching || contacts.length > 0 || searchError || query.trim().length >= 2) && (
        <div className="border rounded mt-2 overflow-hidden">
          {searching && <div className="px-2 py-1 small text-muted">Searching contacts…</div>}
          {!searching && searchError && <div className="px-2 py-1 small text-danger" role="status">{searchError}</div>}
          {!searching && contacts.map((contact) => (
            <button
              type="button"
              key={`${contact.type}:${contact.id}`}
              className="align-items-center bg-white border-0 border-bottom d-flex gap-2 justify-content-between px-2 py-2 text-start w-100 hover:bg-gray-100 dark:bg-gray-800"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addRecipient({
                type: contact.type,
                id: contact.id,
                email: contact.email,
                name: contact.name,
                email_verified: contact.email_verified,
              })}
            >
              <span className="min-w-0">
                <span className="d-block text-truncate">{contact.name}</span>
                <span className="d-block small text-muted text-truncate">{contact.email}</span>
              </span>
              <span className="badge bg-secondary flex-shrink-0">{CONTACT_LABELS[contact.type]}</span>
            </button>
          ))}
          {!searching && !searchError && contacts.length === 0 && query.trim().length >= 2 && (
            <div className="px-2 py-1 small text-muted">No matching contacts. Press Enter to add a valid external email.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmailComposer({
  page,
  value,
  onChange,
  fromEmail,
  senderVerified,
  attachmentName,
  sending = false,
  error = "",
  success = "",
  verification = null,
  verificationCode = "",
  verificationStatus = "",
  verificationLoading = false,
  onVerificationCodeChange,
  onRequestVerification,
  onConfirmVerification,
  onSend,
}) {
  const updateField = (field, nextValue) => onChange({ ...value, [field]: nextValue });
  const fromEmailId = useId();
  const verificationCodeId = useId();
  const subjectId = useId();
  const bodyId = useId();

  return (
    <div className="d-flex flex-column gap-3">
      <RecipientField
        page={page}
        label="To"
        recipients={value.to}
        onChange={(to) => updateField("to", to)}
      />
      <RecipientField
        page={page}
        label="CC"
        recipients={value.cc}
        onChange={(cc) => updateField("cc", cc)}
      />
      {verification && (
        <div className="border rounded p-2">
          <div className="align-items-center d-flex flex-wrap gap-2 mb-2">
            <span className="badge bg-secondary">Recipient email not verified</span>
            <Button_Toolbar
              icon={EnvelopeIcon}
              label={verificationLoading ? "Sending..." : "Send verification code"}
              onClick={onRequestVerification}
              disabled={verificationLoading}
              className="btn-outline-primary"
              title="Send a verification code to this contact"
            />
          </div>
          <div className="align-items-center d-flex flex-wrap gap-2">
            <Field_Floating id={verificationCodeId} label="Verification code" className="flex-grow-1">
              <InputText
                id={verificationCodeId}
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={verificationCode}
                onChange={(event) => onVerificationCodeChange(event.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder=" "
              />
            </Field_Floating>
            <Button_Toolbar
              icon={EnvelopeIcon}
              label="Verify"
              onClick={onConfirmVerification}
              disabled={verificationLoading || verificationCode.length !== 8}
              className="btn-outline-success"
              title="Verify the recipient email address"
            />
          </div>
          {verificationStatus && <div className="small mt-2 text-muted" role="status">{verificationStatus}</div>}
        </div>
      )}
      <div>
        <Field_Floating id={fromEmailId} label="From / reply address">
          <InputText
            id={fromEmailId}
            type="email"
            value={fromEmail || ""}
            readOnly
            aria-readonly="true"
            placeholder=" "
          />
        </Field_Floating>
        {senderVerified && <div className="form-text mt-1">The verified company address is used for replies.</div>}
        {!senderVerified && <div className="form-text mt-1 text-warning">Verify the company sending email in Profile &gt; General Settings before sending.</div>}
      </div>
      <Field_Floating id={subjectId} label="Subject">
        <InputText
          id={subjectId}
          type="text"
          value={value.subject}
          maxLength={200}
          onChange={(event) => updateField("subject", event.target.value)}
          placeholder=" "
        />
      </Field_Floating>
      <Field_Floating id={bodyId} label="Body">
        <InputTextarea
          id={bodyId}
          className="ui-description-textarea"
          rows={7}
          maxLength={100000}
          value={value.body}
          onChange={(event) => updateField("body", event.target.value)}
        />
      </Field_Floating>
      <div className="bg-gray-50 dark:bg-gray-800 rounded px-2 py-2 small">
        <span className="fw-medium">PDF attachment:</span> {attachmentName}
      </div>
      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
      {success && <div className="alert alert-success py-2 small" role="status">{success}</div>}
      <div className="d-flex justify-content-end">
        <Button_Toolbar
          icon={EnvelopeIcon}
          label={sending ? "Sending..." : success ? "Sent" : "Send email"}
          onClick={onSend}
          disabled={sending || Boolean(success) || !value.to.length || !value.subject.trim() || !value.body.trim() || !senderVerified}
          className={success ? "btn-success" : "btn-primary"}
          title={success ? "Email sent successfully" : "Send this email with the generated PDF attachment"}
        />
      </div>
    </div>
  );
}
