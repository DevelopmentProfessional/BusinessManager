/**
 * showConfirm — Bootstrap-styled imperative confirmation dialog.
 *
 * Replaces window.confirm() with a styled modal that shows the company name
 * in the header instead of the browser URL/IP.
 *
 * Usage:
 *   const ok = await showConfirm('Delete this item?');
 *   const ok = await showConfirm('Continue?', { confirmLabel: 'Continue', danger: false });
 */

function getCompanyName() {
  try {
    const b = JSON.parse(localStorage.getItem('app_branding') || '{}');
    return b.companyName || 'Confirm';
  } catch {
    return 'Confirm';
  }
}

export function showConfirm(message, { confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true } = {}) {
  return new Promise((resolve) => {
    // Remove any stale dialog
    document.getElementById('__bm_confirm_wrap')?.remove();
    document.getElementById('__bm_confirm_bd')?.remove();

    const companyName = getCompanyName();
    const headerClass = danger ? 'bg-danger text-white' : 'bg-primary text-white';
    const btnClass = danger ? 'btn-danger' : 'btn-primary';

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = '__bm_confirm_bd';
    backdrop.style.cssText =
      'position:fixed;inset:0;z-index:1055;background:rgba(0,0,0,0.5);';
    document.body.appendChild(backdrop);

    // Dialog wrapper (centers the modal-content)
    const wrap = document.createElement('div');
    wrap.id = '__bm_confirm_wrap';
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:1056;display:flex;align-items:center;justify-content:center;padding:1rem;';
    wrap.innerHTML = `
      <div style="width:100%;max-width:400px;">
        <div class="modal-content shadow border-0 rounded-3">
          <div class="modal-header ${headerClass} border-0 rounded-top-3 px-4 py-3">
            <h6 class="modal-title fw-semibold mb-0">${companyName}</h6>
          </div>
          <div class="modal-body px-4 py-3">
            <p class="mb-0">${message}</p>
          </div>
          <div class="modal-footer border-top-0 px-4 pb-3 pt-1 gap-2 justify-content-end">
            <button type="button" class="btn btn-secondary btn-sm" id="__bm_cancel_btn">${cancelLabel}</button>
            <button type="button" class="btn ${btnClass} btn-sm" id="__bm_ok_btn">${confirmLabel}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const cleanup = (result) => {
      wrap.remove();
      backdrop.remove();
      resolve(result);
    };

    document.getElementById('__bm_ok_btn').addEventListener('click', () => cleanup(true));
    document.getElementById('__bm_cancel_btn').addEventListener('click', () => cleanup(false));
    backdrop.addEventListener('click', () => cleanup(false));
  });
}
