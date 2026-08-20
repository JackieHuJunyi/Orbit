"use client";

import { ArrowRight, Check, KeyRound, Laptop, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ModelProfileManager } from "./model-profile-manager";
import type { RuneLocale } from "../lib/localization";
import type { ModelProviderStatus, RuneModelMode } from "../lib/model-preference";

export type WelcomeModelCopy = Readonly<{
  modelEyebrow: string;
  modelTitle: string;
  modelBody: string;
  checkingModel: string;
  connectedModel: string;
  connectedModelBody: string;
  noModel: string;
  noModelBody: string;
  useConnected: string;
  useConnectedBody: string;
  useLocal: string;
  useLocalBody: string;
  recheck: string;
  modelSafety: string;
  modelUnavailable: string;
  continue: string;
}>;

export function WelcomeModelStep({
  copy,
  locale,
  modelMode,
  onContinue,
  onModelModeChange,
}: {
  copy: WelcomeModelCopy;
  locale: RuneLocale;
  modelMode: RuneModelMode;
  onContinue: (configured: boolean) => void;
  onModelModeChange: (mode: RuneModelMode) => void;
}) {
  const [modelStatus, setModelStatus] = useState<ModelProviderStatus | null>(null);
  const [modelStatusError, setModelStatusError] = useState("");
  const [checkingModel, setCheckingModel] = useState(true);

  const checkModelStatus = useCallback(async () => {
    setCheckingModel(true);
    setModelStatusError("");
    try {
      const response = await fetch("/api/model-status", { cache: "no-store" });
      if (!response.ok) throw new Error("status unavailable");
      const status = (await response.json()) as ModelProviderStatus;
      if (typeof status.configured !== "boolean") throw new Error("invalid status");
      setModelStatus(status);
    } catch {
      setModelStatus(null);
      setModelStatusError(copy.modelUnavailable);
    } finally {
      setCheckingModel(false);
    }
  }, [copy.modelUnavailable]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/model-status", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("status unavailable");
        return response.json() as Promise<ModelProviderStatus>;
      })
      .then((status) => {
        if (typeof status.configured !== "boolean") throw new Error("invalid status");
        setModelStatus(status);
        setModelStatusError("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setModelStatus(null);
        setModelStatusError(copy.modelUnavailable);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCheckingModel(false);
      });
    return () => controller.abort();
  }, [copy.modelUnavailable]);

  const handleProfileStatus = useCallback(
    (status: ModelProviderStatus) => {
      setModelStatus(status);
      setModelStatusError("");
      onModelModeChange(status.configured ? "auto" : "local");
    },
    [onModelModeChange],
  );

  return (
    <>
      <div className="welcome-icon-disc">
        <KeyRound />
      </div>
      <span className="welcome-eyebrow">{copy.modelEyebrow}</span>
      <h1 id="welcome-title">{copy.modelTitle}</h1>
      <p>{copy.modelBody}</p>
      <div className="model-setup-panel">
        <div className={`model-status-card ${modelStatus?.configured ? "connected" : ""}`} role="status">
          <span>
            {modelStatus?.configured ? <Check /> : checkingModel ? <RefreshCw className="agent-spinner" /> : <Server />}
          </span>
          <div>
            <strong>
              {checkingModel ? copy.checkingModel : modelStatus?.configured ? copy.connectedModel : copy.noModel}
            </strong>
            <small>
              {modelStatusError ||
                (modelStatus?.configured
                  ? `${modelStatus.profileName ?? (modelStatus.provider === "openai" ? "OpenAI" : "Model")} · ${modelStatus.model ?? "Model"} · ${copy.connectedModelBody}`
                  : copy.noModelBody)}
            </small>
          </div>
          <button type="button" onClick={() => void checkModelStatus()} disabled={checkingModel}>
            <RefreshCw />
            {copy.recheck}
          </button>
        </div>
        <div className="model-mode-options" role="radiogroup" aria-label={copy.modelTitle}>
          <button
            type="button"
            role="radio"
            aria-checked={modelMode === "auto" && Boolean(modelStatus?.configured)}
            className={modelMode === "auto" && modelStatus?.configured ? "selected" : ""}
            disabled={!modelStatus?.configured}
            onClick={() => onModelModeChange("auto")}
          >
            <span>
              <Server />
            </span>
            <span>
              <strong>{copy.useConnected}</strong>
              <small>{copy.useConnectedBody}</small>
            </span>
            {modelMode === "auto" && modelStatus?.configured ? <Check /> : null}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={modelMode === "local"}
            className={modelMode === "local" ? "selected" : ""}
            onClick={() => onModelModeChange("local")}
          >
            <span>
              <Laptop />
            </span>
            <span>
              <strong>{copy.useLocal}</strong>
              <small>{copy.useLocalBody}</small>
            </span>
            {modelMode === "local" ? <Check /> : null}
          </button>
        </div>
        {!checkingModel && <ModelProfileManager locale={locale} onStatusChange={handleProfileStatus} />}
        <p className="model-safety-note">
          <ShieldCheck />
          {copy.modelSafety}
        </p>
      </div>
      <button className="welcome-primary" type="button" onClick={() => onContinue(Boolean(modelStatus?.configured))}>
        {copy.continue}
        <ArrowRight />
      </button>
    </>
  );
}
