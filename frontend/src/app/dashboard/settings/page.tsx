"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Key, Eye, EyeOff, Trash2, Save, CheckCircle, AlertCircle, Server } from "lucide-react";
import { api, isAuthenticated, getUser } from "@/lib/api";
import type { ApiKeyEntry, ApiKeysResponse } from "@/lib/api";

const PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 200+ models (GPT-4o, Claude, Gemini, Llama, etc.)",
    placeholder: "sk-or-v1-...",
    modelsUrl: "https://openrouter.ai/models",
    defaultModel: "google/gemini-2.0-flash-001",
    popularModels: [
      "google/gemini-2.0-flash-001",
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    description: "Sonar search-augmented model for real-time financial data",
    placeholder: "pplx-...",
    modelsUrl: "https://docs.perplexity.ai",
    defaultModel: "sonar",
    popularModels: ["sonar", "sonar-pro"],
  },
];

interface ProviderFormState {
  apiKey: string;
  model: string;
  showKey: boolean;
  saving: boolean;
  deleting: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const user = getUser();
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState({ openrouter: false, perplexity: false });
  const [savedKeys, setSavedKeys] = useState<Record<string, ApiKeyEntry>>({});
  const [forms, setForms] = useState<Record<string, ProviderFormState>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const clearFeedback = useCallback(() => {
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (feedback) return clearFeedback();
  }, [feedback, clearFeedback]);

  const loadKeys = useCallback(async () => {
    try {
      const data: ApiKeysResponse = await api.getApiKeys();
      const keyMap: Record<string, ApiKeyEntry> = {};
      for (const k of data.keys) keyMap[k.provider] = k;
      setSavedKeys(keyMap);
      setServerInfo({
        openrouter: data.server_has_openrouter,
        perplexity: data.server_has_perplexity,
      });

      const initial: Record<string, ProviderFormState> = {};
      for (const p of PROVIDERS) {
        initial[p.id] = {
          apiKey: "",
          model: keyMap[p.id]?.model_preference || p.defaultModel,
          showKey: false,
          saving: false,
          deleting: false,
        };
      }
      setForms(initial);
    } catch {
      setFeedback({ type: "error", message: "Failed to load API key settings" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadKeys();
  }, [loadKeys, router]);

  const updateForm = (providerId: string, updates: Partial<ProviderFormState>) => {
    setForms((prev) => ({ ...prev, [providerId]: { ...prev[providerId], ...updates } }));
  };

  const handleSave = async (providerId: string) => {
    const form = forms[providerId];
    if (!form.apiKey.trim()) {
      setFeedback({ type: "error", message: "Please enter an API key" });
      return;
    }
    updateForm(providerId, { saving: true });
    try {
      await api.saveApiKey(providerId, form.apiKey, form.model);
      setFeedback({ type: "success", message: `${providerId === "openrouter" ? "OpenRouter" : "Perplexity"} key saved successfully` });
      updateForm(providerId, { apiKey: "", saving: false });
      await loadKeys();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save key";
      setFeedback({ type: "error", message: msg });
      updateForm(providerId, { saving: false });
    }
  };

  const handleDelete = async (providerId: string) => {
    updateForm(providerId, { deleting: true });
    try {
      await api.deleteApiKey(providerId);
      setFeedback({ type: "success", message: `${providerId === "openrouter" ? "OpenRouter" : "Perplexity"} key removed` });
      updateForm(providerId, { deleting: false });
      await loadKeys();
    } catch {
      setFeedback({ type: "error", message: "Failed to delete key" });
      updateForm(providerId, { deleting: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900">API Key Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bring your own API keys for AI-powered financial analysis. Your keys are encrypted at rest.
          </p>
          {user && (
            <p className="mt-1 text-xs text-slate-400">Signed in as {user.email}</p>
          )}
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="text-sm">{feedback.message}</span>
          </div>
        )}

        {/* Provider cards */}
        <div className="space-y-6">
          {PROVIDERS.map((provider) => {
            const saved = savedKeys[provider.id];
            const form = forms[provider.id];
            if (!form) return null;
            const serverHasKey = provider.id === "openrouter" ? serverInfo.openrouter : serverInfo.perplexity;

            return (
              <div key={provider.id} className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                      <Key className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">{provider.name}</h2>
                      <p className="text-xs text-slate-500">{provider.description}</p>
                    </div>
                  </div>
                  {saved && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </div>

                {/* Server fallback info */}
                {serverHasKey && !saved && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
                    <Server className="h-3.5 w-3.5" />
                    Server-provided key available as fallback
                  </div>
                )}

                {/* Saved key display */}
                {saved && (
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <span className="font-mono text-sm text-slate-600">{saved.masked_key}</span>
                      {saved.model_preference && (
                        <span className="ml-3 text-xs text-slate-400">Model: {saved.model_preference}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(provider.id)}
                      disabled={form.deleting}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      aria-label={`Remove ${provider.name} key`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Key input form */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      {saved ? "Replace API Key" : "API Key"}
                    </label>
                    <div className="relative">
                      <input
                        type={form.showKey ? "text" : "password"}
                        value={form.apiKey}
                        onChange={(e) => updateForm(provider.id, { apiKey: e.target.value })}
                        placeholder={provider.placeholder}
                        autoComplete="off"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 font-mono text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => updateForm(provider.id, { showKey: !form.showKey })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={form.showKey ? "Hide key" : "Show key"}
                      >
                        {form.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Model Preference
                    </label>
                    <select
                      value={form.model}
                      onChange={(e) => updateForm(provider.id, { model: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {provider.popularModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <a
                      href={provider.modelsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-blue-500 hover:underline"
                    >
                      Browse available models
                    </a>
                  </div>

                  <button
                    onClick={() => handleSave(provider.id)}
                    disabled={form.saving || !form.apiKey.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    {form.saving ? "Saving..." : saved ? "Update Key" : "Save Key"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">How it works</h3>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
            <li>Your keys are encrypted with AES-256 before storage — the server never stores plaintext keys.</li>
            <li>When you ask AI a question, your personal key is used first. If not set, the server&apos;s key is used as a fallback.</li>
            <li>Keys are scoped to your account only — other users cannot access them.</li>
            <li>You can remove your key at any time to revert to server-provided access.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
