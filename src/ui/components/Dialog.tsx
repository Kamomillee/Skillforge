import { useEffect, useRef, type ReactNode } from "react";

/** Boîte de dialogue modale native (<dialog>) : focus piégé et Échap gérés par le navigateur. */
export function Dialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title">
      <h2 id="dlg-title">{title}</h2>
      <div style={{ marginBottom: 20 }}>{children}</div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {actions}
      </div>
    </dialog>
  );
}

export function ConfirmDialog(props: { open: boolean; title: string; message: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel}
      title={props.title}
      actions={
        <>
          <button className="btn" onClick={props.onCancel} autoFocus>
            Annuler
          </button>
          <button className={`btn ${props.danger ? "danger" : "primary"}`} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </>
      }
    >
      {props.message}
    </Dialog>
  );
}
