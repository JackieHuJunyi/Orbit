"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  agentModelSelectionOpensSettings,
  agentModelSelectionRequest,
  buildAgentModelOptions,
  discoveredAgentModelId,
  selectedAgentModelValue,
} from "../lib/agent-model-options";
import {
  discoverDesktopModelConnections,
  supportsDesktopModelDiscovery,
  type DesktopModelDiscovery,
} from "../lib/desktop-bridge";
import { connectDiscoveredModelConnection, type ModelConnectionPhase } from "../lib/model-connection-client";
import { orbitText, type OrbitLocale, type OrbitUICopy } from "../lib/localization";
import { isAccountModelProvider, type ModelProfilesState } from "../lib/model-profiles";
import { ORBIT_MODEL_MODE_STORAGE_KEY, type OrbitModelMode } from "../lib/model-preference";

export type AgentModelDiscoveryState = "idle" | "scanning" | "complete" | "unavailable" | "error";

export function useAgentModelController({
  composerOpen,
  hydrated,
  locale,
  setNotice,
  ui,
  welcomeOpen,
}: {
  composerOpen: boolean;
  hydrated: boolean;
  locale: OrbitLocale;
  setNotice: (notice: string) => void;
  ui: OrbitUICopy["workbench"];
  welcomeOpen: boolean;
}) {
  const [mode, setMode] = useState<OrbitModelMode>("model-assisted");
  const [profiles, setProfiles] = useState<ModelProfilesState | null>(null);
  const [switching, setSwitching] = useState(false);
  const [discovery, setDiscovery] = useState<DesktopModelDiscovery | null>(null);
  const [profileModels, setProfileModels] = useState<Record<string, readonly string[]>>({});
  const [discoveryState, setDiscoveryState] = useState<AgentModelDiscoveryState>("idle");
  const discoveryInFlightRef = useRef(false);
  const catalogRequestRef = useRef(0);

  const refreshProfileModels = useCallback(async (state: ModelProfilesState) => {
    const request = ++catalogRequestRef.current;
    const catalogs = await loadProfileModelCatalogs(state);
    if (request === catalogRequestRef.current) setProfileModels(catalogs);
  }, []);

  const setPreferredMode = useCallback((nextMode: OrbitModelMode) => {
    setMode(nextMode);
    try {
      localStorage.setItem(ORBIT_MODEL_MODE_STORAGE_KEY, nextMode);
    } catch {
      // This preference contains no credential; in-memory mode remains available.
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const response = await fetch("/api/model-profiles", { cache: "no-store", credentials: "same-origin" });
      const payload = (await response.json()) as ModelProfilesState;
      if (!response.ok || !Array.isArray(payload.profiles) || typeof payload.configured !== "boolean") return;
      setProfiles(payload);
      void refreshProfileModels(payload);
    } catch {
      // Free-text composition and deterministic local tools remain available.
    }
  }, [refreshProfileModels]);

  const refreshDiscovery = useCallback(async () => {
    if (discoveryInFlightRef.current) return;
    if (!supportsDesktopModelDiscovery()) {
      setDiscoveryState("unavailable");
      setDiscovery({ supported: true, accounts: [], candidates: [] });
      return;
    }
    discoveryInFlightRef.current = true;
    setDiscoveryState("scanning");
    try {
      setDiscovery(await discoverDesktopModelConnections());
      setDiscoveryState("complete");
    } catch {
      setDiscoveryState("error");
    } finally {
      discoveryInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!composerOpen || !hydrated || welcomeOpen) return;
    const frame = window.requestAnimationFrame(() => void refreshProfiles());
    return () => window.cancelAnimationFrame(frame);
  }, [composerOpen, hydrated, refreshProfiles, welcomeOpen]);

  useEffect(() => {
    if (!composerOpen || !hydrated || welcomeOpen) return;
    const frame = window.requestAnimationFrame(() => void refreshDiscovery());
    return () => window.cancelAnimationFrame(frame);
  }, [composerOpen, hydrated, refreshDiscovery, welcomeOpen]);

  const options = useMemo(
    () =>
      buildAgentModelOptions(
        profiles,
        discovery,
        {
          local: ui.localFallback,
          localDetail: ui.localModelDetail,
          connected: ui.modelConnected,
          needsSignIn: ui.modelNeedsSignIn,
        },
        profileModels,
      ),
    [discovery, profileModels, profiles, ui.localFallback, ui.localModelDetail, ui.modelConnected, ui.modelNeedsSignIn],
  );
  const selected = selectedAgentModelValue(mode, profiles, options);

  const change = useCallback(
    async (
      value: string,
      controls: { blocked: boolean; onError: (message: string) => void; onOpenSettings: () => void },
    ) => {
      if (switching || controls.blocked) return;
      if (agentModelSelectionOpensSettings(value)) {
        controls.onOpenSettings();
        return;
      }
      setSwitching(true);
      controls.onError("");
      try {
        if (value === "local") {
          setPreferredMode("device-tools-only");
          setNotice(orbitText(locale, "Agent will use local tools", "Agent 将使用本地工具"));
          return;
        }
        const discoveredId = discoveredAgentModelId(value);
        if (discoveredId) {
          const candidate = discovery?.candidates.find((item) => item.id === discoveredId);
          if (!candidate) throw new Error("That discovered model is no longer available. Scan this Mac again.");
          const saved = await connectDiscoveredModelConnection({
            candidate,
            accounts: discovery?.accounts ?? [],
            onPhase: (phase) => setNotice(connectionPhaseNotice(locale, phase, candidate.name, candidate.sourceLabel)),
          });
          setProfiles(saved);
          void refreshProfileModels(saved);
          setPreferredMode("model-assisted");
          setNotice(orbitText(locale, `Connected · ${candidate.name}`, `已连接 · ${candidate.name}`));
          void refreshDiscovery();
          return;
        }
        const requestBody = agentModelSelectionRequest(value);
        if (!requestBody) throw new Error("Orbit could not read that model selection.");
        const response = await fetch("/api/model-profiles", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const payload = (await response.json()) as ModelProfilesState & { error?: unknown };
        if (!response.ok || !payload.configured) {
          throw new Error(
            typeof payload.error === "string" ? payload.error : "Orbit could not activate that model connection.",
          );
        }
        setProfiles(payload);
        setPreferredMode("model-assisted");
        const label = options.find((option) => option.value === value)?.label ?? ui.modelConnected;
        setNotice(orbitText(locale, `Model switched · ${label}`, `已切换模型 · ${label}`));
      } catch (error) {
        controls.onError(error instanceof Error ? error.message : "Orbit could not switch models.");
      } finally {
        setSwitching(false);
      }
    },
    [
      discovery,
      locale,
      options,
      refreshDiscovery,
      refreshProfileModels,
      setNotice,
      setPreferredMode,
      switching,
      ui.modelConnected,
    ],
  );

  return {
    change,
    discoveryState,
    mode,
    options,
    refreshDiscovery,
    restoreMode: setMode,
    selected,
    setPreferredMode,
    switching,
  } as const;
}

async function loadProfileModelCatalogs(state: ModelProfilesState) {
  const entries = await Promise.all(
    state.profiles
      .filter((profile) => !isAccountModelProvider(profile.provider))
      .map(async (profile) => {
        try {
          const response = await fetch("/api/model-profiles", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "models", profile }),
          });
          const payload = (await response.json()) as { models?: unknown };
          const models = Array.isArray(payload.models)
            ? payload.models.filter((model): model is string => typeof model === "string").slice(0, 80)
            : [];
          return [profile.id, models] as const;
        } catch {
          return [profile.id, []] as const;
        }
      }),
  );
  return Object.fromEntries(entries) as Record<string, readonly string[]>;
}

function connectionPhaseNotice(locale: OrbitLocale, phase: ModelConnectionPhase, name: string, sourceLabel: string) {
  const english =
    phase === "reading"
      ? `Reading ${sourceLabel}`
      : phase === "catalog"
        ? `Checking ${name} models`
        : phase === "response"
          ? "Verifying one structured response"
          : `Saving ${name} on this device`;
  const chinese =
    phase === "reading"
      ? `正在读取 ${sourceLabel}`
      : phase === "catalog"
        ? `正在检查 ${name} 模型`
        : phase === "response"
          ? "正在验证一次结构化响应"
          : `正在将 ${name} 保存到本机`;
  return orbitText(locale, english, chinese);
}
