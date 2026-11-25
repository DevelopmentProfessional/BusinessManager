import React, { useEffect, useMemo, useState } from "react";
import { InputNumber, InputText, InputTextarea } from "../Inputs";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { PlusIcon, XMarkIcon, CheckIcon } from "../../../icons";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";

const NEW_MEMBERSHIP_ID = "new";

export default function Modal_Client_Subscriptions({
  isOpen,
  onClose,
  container,
  memberships = [],
  membershipForm,
  setMembershipForm,
  editingMembershipId,
  onSave,
  onEdit,
  onDelete,
  onReset,
  saving = false,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const sortedMemberships = useMemo(() => [...memberships].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [memberships]);
  const selectedMembership = sortedMemberships.find((membership) => String(membership.id) === String(selectedId));

  useEffect(() => {
    if (selectedId === NEW_MEMBERSHIP_ID) {
      onReset?.();
    } else if (selectedMembership) {
      onEdit(selectedMembership);
    }
  }, [selectedId, selectedMembership?.id]);

  const handleSave = async (event) => {
    event?.preventDefault();
    await onSave();
    setSelectedId(null);
  };

  const closeDetail = () => {
    setSelectedId(null);
    onReset?.();
  };

  const closeManager = () => {
    closeDetail();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      container={container}
      onClose={closeManager}
      title="Manage Subscriptions"
      centered={true}
      contentGravity="bottom"
      footer={
        selectedId !== null ? (
          <>
            <Button_Toolbar type="submit" form="subscription-form" icon={CheckIcon} label={editingMembershipId ? "Update" : "Create"} disabled={saving} className="btn-primary" title="Save subscription" />
            <Button_Toolbar icon={XMarkIcon} label="" onClick={closeDetail} className="btn-outline-secondary" title="Cancel" />
          </>
        ) : (
          <>
            <Button_Toolbar icon={PlusIcon} label="Add" onClick={() => setSelectedId(NEW_MEMBERSHIP_ID)} className="btn-primary" title="Create subscription" />
            <Button_Toolbar icon={XMarkIcon} label="" onClick={closeManager} className="btn-outline-secondary" title="Cancel" />
          </>
        )
      }
    >
      <div className="d-flex flex-column h-100 min-h-0 p-2">
        <SettingsMasterDetail
          detailOpen={selectedId !== null}
          onBack={closeDetail}
          list={
            <div className="d-flex flex-column h-100 min-h-0">
              <div className="mb-2">
                <h5 className="mb-0">Subscriptions</h5>
              </div>
              <SettingsMasterDetailTable
                columns={[
                  { label: "", style: { width: 48 } },
                  { label: "Subscription" },
                  { label: "Price" },
                  { label: "Frequency" },
                ]}
              >
                {sortedMemberships.length === 0 ? (
                  <tr><td colSpan={4} className="ui-small-muted text-center py-2">No subscriptions yet.</td></tr>
                ) : sortedMemberships.map((membership) => (
                  <tr key={membership.id} className={String(membership.id) === String(selectedId) ? "table-primary" : ""}>
                    <td className="text-center">
                      <button type="button" className="btn btn-bulk-circle btn-outline-danger" onClick={() => onDelete(membership.id)} title="Delete subscription">
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                    <td>
                      <button type="button" className="btn btn-link fw-medium p-0 text-start text-decoration-none" onClick={() => setSelectedId(membership.id)}>
                        {membership.name}
                      </button>
                    </td>
                    <td>${Number(membership.price || 0).toFixed(2)}</td>
                    <td className="text-capitalize">{membership.billing_frequency || "monthly"}</td>
                  </tr>
                ))}
              </SettingsMasterDetailTable>
            </div>
          }
          detail={
            selectedId === NEW_MEMBERSHIP_ID || selectedMembership ? (
              <form id="subscription-form" onSubmit={handleSave} className="d-flex flex-column gap-3">
                <h5 className="mb-0">{editingMembershipId ? "Edit Subscription" : "New Subscription"}</h5>
                <div className="form-floating">
                  <InputText id="subscription-name" className="form-control" placeholder="Subscription name" value={membershipForm.name} onChange={(e) => setMembershipForm((p) => ({ ...p, name: e.target.value }))} />
                  <label htmlFor="subscription-name">Subscription name *</label>
                </div>
                <div className="d-flex gap-2">
                  <div className="form-floating flex-grow-1">
                    <InputNumber id="subscription-price" min="0" step="0.01" className="form-control" placeholder="Price" value={membershipForm.price} onChange={(e) => setMembershipForm((p) => ({ ...p, price: e.target.value }))} />
                    <label htmlFor="subscription-price">Price</label>
                  </div>
                  <Dropdown_Custom
                    className="ui-control-sm flex-grow-1"
                    value={membershipForm.billing_frequency}
                    onChange={(e) => setMembershipForm((p) => ({ ...p, billing_frequency: e.target.value }))}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "yearly", label: "Yearly" },
                    ]}
                    placeholder="Billing frequency"
                    closeOnSelect
                  />
                </div>
                <div className="d-flex gap-2">
                  <div className="form-floating flex-grow-1">
                    <InputNumber id="subscription-lock-term" min="0" className="form-control" placeholder="Lock term" value={membershipForm.lock_term_count} onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_count: e.target.value }))} />
                    <label htmlFor="subscription-lock-term">Lock term</label>
                  </div>
                  <Dropdown_Custom
                    className="ui-control-sm flex-grow-1"
                    value={membershipForm.lock_term_unit}
                    onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_unit: e.target.value }))}
                    options={[
                      { value: "days", label: "Days" },
                      { value: "weeks", label: "Weeks" },
                      { value: "months", label: "Months" },
                      { value: "years", label: "Years" },
                    ]}
                    placeholder="Lock term unit"
                    closeOnSelect
                  />
                </div>
                <div className="form-floating">
                  <InputTextarea id="subscription-description" className="ui-description-textarea form-control" rows={6} placeholder="Description" value={membershipForm.description} onChange={(e) => setMembershipForm((p) => ({ ...p, description: e.target.value }))} />
                  <label htmlFor="subscription-description">Description</label>
                </div>
              </form>
            ) : (
              <div className="align-items-center d-flex h-100 justify-content-center text-muted">Select a subscription or create a new one.</div>
            )
          }
        />
      </div>
    </Modal>
  );
}
