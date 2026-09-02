"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Cpu,
  HardDrive,
  KeyRound,
  Laptop,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModelProfileManager } from "./model-profile-manager";
import {
  discoverDesktopModelConnections,
  importDesktopModelConnection,
  supportsDesktopModelDiscovery,
  type DiscoveredModelConnection,
} from "../lib/desktop-bridge";
import type { RuneLocale } from "../lib/localization";
import type { ModelProfilesState } from "../lib/model-profiles";
import type { ModelProviderStatus, RuneModelMode } from "../lib/model-preference";

export type WelcomeModelCopy = Readonly<{
  back: string;
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
  discoveryScanning: string;
  discoveryTitle: string;
  discoveryBody: string;
  discoveryEmpty: string;
  discoveryEmptyBody: string;
  discoveryUnavailable: string;
  discoveryError: string;
  deviceModel: string;
  cloudModel: string;
  sourceLabel: string;
  modelLabel: string;
  endpointLabel: string;
  deploymentConnection: string;
  credentialDetected: string;
  credentialNotRequired: string;
  reviewConnection: string;
  reviewTitle: string;
  connectionReviewBody: string;
  connectAndVerify: string;
  connecting: string;
  chooseAnother: string;
  connectionFailed: string;
  scanPrivacy: string;
  modelSafety: string;
  modelUnavailable: string;
  continue: string;
}>;

type DiscoveryState = "idle" | "scanning" | "complete" | "unavailable" | "error";

function providerStatusFromState(state: ModelProfilesState, deploymentConnection: string): ModelProviderStatus {
  const active = state.activeProfile;
  if (active) {
    return {
      configured: true,
      provider: active.provider,
      model: active.model,
      source: "personal",
      profileName: active.name,
      budget: active.budget,
      capabilities: active.capabilities,
      health: active.health,
    };
  }
  return {
    configured: state.deployment.configured,
    provider: state.deployment.provider,
    model: state.deployment.model,
    source: state.deployment.configured ? "deployment" : null,
    profileName: state.deployment.configured ? deploymentConnection : null,
    budget: state.deployment.budget,
    capabilities: state.deployment.capabilities,
    health: state.deployment.health,
  };
}

export function WelcomeModelStep({
  copy,
  locale,
  modelMode,
  onBack,
  onContinue,
  onModelModeChange,
}: {
  copy: WelcomeModelCopy;
  locale: RuneLocale;
  modelMode: RuneModelMode;
  onBack: () => void;
  onContinue: (mode: RuneModelMode) => void;
  onModelModeChange: (mode: RuneModelMode) => void;
}) {
  const [modelStatus, setModelStatus] = useState<ModelProviderStatus | null>(null);
  const [modelStatusError, setModelStatusError] = useState("");
  const [checkingModel, setCheckingModel] = useState(true);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("idle");
  const [candidates, setCandidates] = useState<DiscoveredModelConnection[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DiscoveredModelConnection | null>(null);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [managerRevision, setManagerRevision] = useState(0);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastDiscoveryTriggerRef = useRef<HTMLButtonElement>(null);

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

  const scanDevice = useCallback(async () => {
    if (!supportsDesktopModelDiscovery()) {
      setDiscoveryState("unavailable");
      setCandidates([]);
      return;
    }
    setDiscoveryState("scanning");
    setConnectionError("");
    try {
      const result = await discoverDesktopModelConnections();
      setCandidates(result.candidates);
      setDiscoveryState("complete");
    } catch {
      setCandidates([]);
      setDiscoveryState("error");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void checkModelStatus();
      void scanDevice();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [checkModelStatus, scanDevice]);

  useEffect(() => {
    if (!selectedCandidate) return;
    const frame = window.requestAnimationFrame(() => reviewHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCandidate]);

  const handleProfileStatus = useCallback(
    (status: ModelProviderStatus) => {
      setModelStatus(status);
      setModelStatusError("");
      if (status.configured) onModelModeChange("model-assisted");
    },
    [onModelModeChange],
  );

  function closeReview() {
    setSelectedCandidate(null);
    setConnectionError("");
    window.requestAnimationFrame(() => lastDiscoveryTriggerRef.current?.focus());
  }

  async function connectCandidate() {
    if (!selectedCandidate || connectionBusy) return;
    setConnectionBusy(true);
    setConnectionError("");
    try {
      const profile = await importDesktopModelConnection(selectedCandidate.id);
      const modelResponse = await fetch("/api/model-profiles", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "models", profile }),
      });
      const modelPayload = (await modelResponse.json()) as { models?: unknown; error?: unknown };
      if (!modelResponse.ok || !Array.isArray(modelPayload.models) || !modelPayload.models.length) {
        throw new Error("verification failed");
      }
      const models = modelPayload.models.filter((item): item is string => typeof item === "string");
      const verifiedProfile = { ...profile, model: models.includes(profile.model) ? profile.model : models[0] };
      const saveResponse = await fetch("/api/model-profiles", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "upsert", profile: verifiedProfile }),
      });
      const saved = (await saveResponse.json()) as ModelProfilesState & { error?: unknown };
      if (!saveResponse.ok || typeof saved.configured !== "boolean") throw new Error("save failed");
      setModelStatus(providerStatusFromState(saved, copy.deploymentConnection));
      onModelModeChange("model-assisted");
      setManagerRevision((current) => current + 1);
      setSelectedCandidate(null);
      setConnectionError("");
    } catch {
      setConnectionError(copy.connectionFailed);
    } finally {
      setConnectionBusy(false);
    }
  }

  const configured = Boolean(modelStatus?.configured);

  return (
    <>
      <div className="welcome-icon-disc">
        <KeyRound />
      </div>
      <span className="welcome-eyebrow">{copy.modelEyebrow}</span>
      <h1 id="welcome-title">{copy.modelTitle}</h1>
      <p>{copy.modelBody}</p>
      <div className="model-setup-panel">
        {(checkingModel || configured || modelStatusError) && (
          <div className={`model-status-card ${configured ? "connected" : ""}`} role="status">
            <span>
              {configured ? <Check /> : checkingModel ? <RefreshCw className="agent-spinner" /> : <HardDrive />}
            </span>
            <div>
              <strong>{checkingModel ? copy.checkingModel : configured ? copy.connectedModel : copy.noModel}</strong>
              <small>
                {modelStatusError ||
                  (configured
                    ? `${
                        modelStatus?.source === "deployment"
                          ? copy.deploymentConnection
                          : (modelStatus?.profileName ?? copy.modelLabel)
                      } · ${modelStatus?.model ?? copy.modelLabel} · ${copy.connectedModelBody}`
                    : copy.noModelBody)}
              </small>
            </div>
          </div>
        )}

        <section
          className="model-discovery"
          data-discovery-state={discoveryState}
          aria-labelledby="model-discovery-title"
        >
          <header>
            <span>{discoveryState === "scanning" ? <Search className="agent-spinner" /> : <Laptop />}</span>
            <div>
              <strong id="model-discovery-title">
                {discoveryState === "scanning" ? copy.discoveryScanning : copy.discoveryTitle}
              </strong>
              <small>{copy.discoveryBody}</small>
            </div>
            {discoveryState !== "scanning" && discoveryState !== "unavailable" && (
              <button type="button" onClick={() => void scanDevice()}>
                <RefreshCw />
                {copy.recheck}
              </button>
            )}
          </header>

          {selectedCandidate ? (
            <div className="model-discovery-review">
              <button type="button" className="model-discovery-back" onClick={closeReview} disabled={connectionBusy}>
                <ArrowLeft />
                {copy.chooseAnother}
              </button>
              <h2 ref={reviewHeadingRef} tabIndex={-1}>
                {copy.reviewTitle}
              </h2>
              <p>{copy.connectionReviewBody}</p>
              <dl>
                <div>
                  <dt>{selectedCandidate.locality === "device" ? copy.deviceModel : copy.cloudModel}</dt>
                  <dd>{selectedCandidate.name}</dd>
                </div>
                <div>
                  <dt>{copy.sourceLabel}</dt>
                  <dd>{selectedCandidate.sourceLabel}</dd>
                </div>
                <div>
                  <dt>{copy.modelLabel}</dt>
                  <dd dir="ltr">{selectedCandidate.model}</dd>
                </div>
                <div>
                  <dt>{copy.endpointLabel}</dt>
                  <dd dir="ltr">{selectedCandidate.baseURL}</dd>
                </div>
              </dl>
              {connectionError && (
                <p className="model-manager-error" role="alert">
                  {connectionError}
                </p>
              )}
              <button
                type="button"
                className="welcome-primary"
                disabled={connectionBusy}
                onClick={() => void connectCandidate()}
              >
                {connectionBusy ? <RefreshCw className="agent-spinner" /> : <Check />}
                {connectionBusy ? copy.connecting : copy.connectAndVerify}
              </button>
            </div>
          ) : discoveryState === "complete" && candidates.length ? (
            <div className="model-discovery-results">
              {candidates.map((candidate) => (
                <article key={candidate.id}>
                  <span>{candidate.locality === "device" ? <Cpu /> : <Cloud />}</span>
                  <div>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.model} · {candidate.sourceLabel}
                    </small>
                    <em>
                      {candidate.credentialState === "not-required"
                        ? copy.credentialNotRequired
                        : copy.credentialDetected}
                    </em>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      lastDiscoveryTriggerRef.current = event.currentTarget;
                      setSelectedCandidate(candidate);
                      setConnectionError("");
                    }}
                  >
                    {copy.reviewConnection}
                    <ArrowRight />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="model-discovery-empty">
              <HardDrive />
              <div>
                <strong>
                  {discoveryState === "unavailable"
                    ? copy.discoveryUnavailable
                    : discoveryState === "error"
                      ? copy.discoveryError
                      : discoveryState === "scanning" || discoveryState === "idle"
                        ? copy.discoveryScanning
                        : copy.discoveryEmpty}
                </strong>
                {discoveryState === "complete" && <small>{copy.discoveryEmptyBody}</small>}
              </div>
            </div>
          )}
        </section>

        {!selectedCandidate && (
          <ModelProfileManager key={managerRevision} compact locale={locale} onStatusChange={handleProfileStatus} />
        )}
        <p className="model-safety-note">
          <ShieldCheck />
          {discoveryState === "unavailable" ? copy.modelSafety : copy.scanPrivacy}
        </p>
      </div>
      <div className="welcome-step-navigation welcome-model-navigation">
        <button type="button" className="welcome-step-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {copy.back}
        </button>
        <div className="welcome-model-actions">
          {configured && (
            <button
              className="welcome-primary welcome-model-primary"
              type="button"
              onClick={() => onContinue("model-assisted")}
            >
              <Cloud />
              <span>
                <strong>{copy.useConnected}</strong>
                <small>{copy.useConnectedBody}</small>
              </span>
              <ArrowRight />
            </button>
          )}
          <button
            className="welcome-secondary"
            type="button"
            aria-pressed={modelMode === "device-tools-only"}
            onClick={() => onContinue("device-tools-only")}
          >
            <Laptop />
            <span>
              <strong>{copy.useLocal}</strong>
              <small>{copy.useLocalBody}</small>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
