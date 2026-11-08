"use client";

import { useEffect, useRef, useState } from "react";
import {
  type BinCardFields,
  type CaptureConfirmed,
  type CaptureRead,
} from "../api/client";
import { usePreferences } from "../preferences/preferences";
import { useHashTarget } from "../navigation/nav";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];
type Draft = {
  commodity_name: string;
  opening_balance: string;
  closing_balance: string;
  record_date: string;
};
type Status =
  | "empty"
  | "reading"
  | "review"
  | "confirming"
  | "saving"
  | "saved"
  | "error"
  | "save-error";

function toDraft(fields: Record<string, unknown>): Draft {
  const text = (value: unknown) =>
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  return {
    commodity_name: text(fields.commodity_name),
    opening_balance: text(fields.opening_balance),
    closing_balance: text(fields.closing_balance),
    record_date: text(fields.record_date),
  };
}

function toFields(draft: Draft): BinCardFields | null {
  const count = (value: string) =>
    /^\d{1,10}$/.test(value.trim()) ? Number(value.trim()) : null;
  const name = draft.commodity_name.trim();
  const opening = count(draft.opening_balance);
  const closing = count(draft.closing_balance);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.record_date)
    ? draft.record_date
    : null;
  if (
    !name ||
    name.length > 200 ||
    opening === null ||
    closing === null ||
    !date
  )
    return null;
  return {
    commodity_name: name,
    opening_balance: opening,
    closing_balance: closing,
    record_date: date,
  };
}

/** Online-only synthetic bin-card upload; nothing is saved until a person confirms every field. */
export function BinCardCapture({
  facilityId,
  upload,
  confirm,
}: {
  facilityId: string;
  upload: (file: File, key: string) => Promise<CaptureRead>;
  confirm: (
    captureId: string,
    fields: BinCardFields,
  ) => Promise<CaptureConfirmed>;
}) {
  const { t } = usePreferences();
  useHashTarget("capture-title", true);
  const [online, setOnline] = useState(true);
  const [attested, setAttested] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureRead | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft({}));
  const [status, setStatus] = useState<Status>("empty");
  const [fileError, setFileError] = useState<string | null>(null);
  const [saved, setSaved] = useState<BinCardFields | null>(null);
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    if (status === "confirming") confirmHeading.current?.focus();
  }, [status]);

  function choose(next: File | undefined) {
    setCapture(null);
    setSaved(null);
    setStatus("empty");
    setFileError(null);
    setFile(null);
    setPreview(null);
    if (!next) return;
    if (!TYPES.includes(next.type)) return setFileError(t("captureType"));
    if (next.size > MAX_BYTES) return setFileError(t("captureSize"));
    setFile(next);
    setKey(crypto.randomUUID());
    setPreview(URL.createObjectURL(next));
  }
  async function read() {
    if (!file || !attested || !online) return;
    setStatus("reading");
    try {
      const result = await upload(file, key);
      if (result.status !== "pending" || result.facility_id !== facilityId)
        throw new Error("Unexpected capture");
      setCapture(result);
      const next = toDraft(result.fields);
      setDraft(next);
      setStatus("review");
      // Empty or partial extraction: start typing at the first missing field.
      const missing = (Object.keys(next) as (keyof Draft)[]).find(
        (name) => next[name] === "",
      );
      if (missing)
        requestAnimationFrame(() =>
          document.getElementById(`capture-${missing}`)?.focus(),
        );
    } catch {
      setStatus("error");
    }
  }
  async function save() {
    const fields = toFields(draft);
    if (!capture || !fields || !online) return;
    setStatus("saving");
    try {
      const result = await confirm(capture.id, fields);
      setSaved(result.fields);
      setStatus("saved");
    } catch {
      setStatus("save-error");
    }
  }
  const fields = toFields(draft);
  const extracted = capture?.provider_status === "extracted";
  const unclear =
    capture &&
    extracted &&
    Object.values(capture.fields).some((value) => value === null);
  const field = (name: keyof Draft, label: string, type = "text") => (
    <div className="capture-field">
      <label htmlFor={`capture-${name}`}>{label}</label>
      <input
        id={`capture-${name}`}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        value={draft[name]}
        aria-invalid={draft[name] === "" ? true : undefined}
        disabled={status !== "review" && status !== "save-error"}
        onChange={(event) =>
          setDraft((current) => ({ ...current, [name]: event.target.value }))
        }
      />
    </div>
  );
  return (
    <section className="panel" aria-labelledby="capture-title">
      <h2 id="capture-title">{t("captureTitle")}</h2>
      <p>{t("captureNote")}</p>
      {!online && <p role="status">{t("captureOffline")}</p>}
      <label className="capture-check">
        <input
          type="checkbox"
          checked={attested}
          onChange={(event) => setAttested(event.target.checked)}
        />{" "}
        {t("captureAttest")}
      </label>
      <label htmlFor="capture-file">{t("capturePhoto")}</label>
      <input
        id="capture-file"
        type="file"
        accept={TYPES.join(",")}
        capture="environment"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {fileError && <p role="alert">{fileError}</p>}
      {!file && !fileError && <p>{t("captureEmpty")}</p>}
      <button
        className="rank-action"
        type="button"
        disabled={!file || !attested || !online || status === "reading"}
        onClick={() => void read()}
      >
        {t("captureRead")}
      </button>
      {status === "reading" && <p role="status">{t("captureReading")}</p>}
      {status === "error" && <p role="alert">{t("captureError")}</p>}
      {capture && (
        <div className="capture-review">
          {preview && (
            <figure>
              <img src={preview} alt={t("capturePreviewAlt")} />
            </figure>
          )}
          <div>
            <p role="status">
              {!extracted
                ? t("captureManual")
                : unclear
                  ? t("capturePartial")
                  : t("captureCheck")}
            </p>
            {field("commodity_name", t("captureCommodity"))}
            {field("opening_balance", t("captureOpening"), "number")}
            {field("closing_balance", t("captureClosing"), "number")}
            {field("record_date", t("captureDate"), "date")}
            {status !== "confirming" && status !== "saved" && (
              <button
                className="rank-action"
                type="button"
                disabled={!fields || !online || status === "saving"}
                onClick={() => setStatus("confirming")}
              >
                {t("captureReview")}
              </button>
            )}
            {!fields && status === "review" && <p>{t("captureIncomplete")}</p>}
          </div>
        </div>
      )}
      {status === "confirming" && (
        <div
          className="capture-confirm"
          role="group"
          aria-labelledby="capture-confirm-title"
        >
          <h3 id="capture-confirm-title" ref={confirmHeading} tabIndex={-1}>
            {t("captureConfirmPrompt")}
          </h3>
          <button
            className="rank-action"
            type="button"
            onClick={() => setStatus("review")}
          >
            {t("captureGoBack")}
          </button>{" "}
          <button
            className="rank-action button-primary"
            type="button"
            disabled={!online}
            onClick={() => void save()}
          >
            {t("captureConfirm")}
          </button>
        </div>
      )}
      {status === "saving" && <p role="status">{t("captureSaving")}</p>}
      {status === "save-error" && <p role="alert">{t("captureSaveError")}</p>}
      {status === "saved" && saved && (
        <p role="status">
          {t("captureSaved")} {saved.commodity_name} · {saved.opening_balance} →{" "}
          {saved.closing_balance} · {saved.record_date}
        </p>
      )}
    </section>
  );
}
