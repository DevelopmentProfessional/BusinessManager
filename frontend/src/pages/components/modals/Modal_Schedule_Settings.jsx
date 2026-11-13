// FILE: Modal_Schedule_Settings.jsx
// Dedicated settings/controls modal for the Schedule page wrapping Modal_SettingsSchedule
import React from "react";
import PageControlsModal from "./Page_ControlsModal";
import Modal_SettingsSchedule from "./Modal_SettingsSchedule";

export default function Modal_Schedule_Settings({
  isOpen,
  onClose,
  saving = false,
  onSave,
  user,
  scheduleSettingsRef,
  onSavingChange,
  onSaved,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Page Controls"
      saving={saving}
      onSave={onSave}
    >
      {user?.id ? (
        <Modal_SettingsSchedule
          ref={scheduleSettingsRef}
          hideFooter
          userId={user.id}
          onSavingChange={onSavingChange}
          onSaved={onSaved}
        />
      ) : (
        <div className="ui-small-muted">Sign in to manage schedule settings.</div>
      )}
    </PageControlsModal>
  );
}
