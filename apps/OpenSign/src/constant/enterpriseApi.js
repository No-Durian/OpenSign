import axios from "axios";
import { serverUrl_fn } from "./appinfo";

function resolveLocalDevApiBase(configuredBase) {
  try {
    const configuredUrl = new URL(configuredBase, window.location.origin);
    const isLocalHost = ["localhost", "127.0.0.1"].includes(
      window.location.hostname
    );
    const isConfiguredRemote =
      configuredUrl.hostname !== window.location.hostname;
    if (isLocalHost && isConfiguredRemote) {
      return `${window.location.origin}/api`;
    }
  } catch {
    // fallback to configured base
  }
  return configuredBase;
}

export function getEnterpriseBaseUrl() {
  const configured = serverUrl_fn().replace(/\/app\/?$/, "");
  return resolveLocalDevApiBase(configured);
}

export function getEnterpriseApiUrl(path = "") {
  const base = getEnterpriseBaseUrl();
  return `${base}/enterprise${path}`;
}

async function enterpriseGet(path, config = {}) {
  const { data } = await axios.get(getEnterpriseApiUrl(path), {
    timeout: 10000,
    ...config
  });
  return data;
}

async function enterprisePost(path, payload, config = {}) {
  const { data } = await axios.post(getEnterpriseApiUrl(path), payload, {
    timeout: 10000,
    ...config
  });
  return data;
}

export async function fetchEnterpriseConfig() {
  return enterpriseGet("/config");
}

export async function updateEnterpriseConfig(payload) {
  return enterprisePost("/config", payload);
}

export async function fetchEnterpriseOverview() {
  return enterpriseGet("/overview");
}

export async function fetchEnterpriseSearchOptions() {
  return enterpriseGet("/search/options");
}

export async function searchPolicies(params) {
  return enterpriseGet("/search", { params });
}

export async function fetchPolicyManagement() {
  return enterpriseGet("/management");
}

export async function fetchAiAssistantConfig() {
  return enterpriseGet("/assistant");
}

export function buildPolicyFileUrl(relativePath, scope = "library") {
  return `${getEnterpriseApiUrl("/file")}?scope=${encodeURIComponent(
    scope
  )}&relativePath=${encodeURIComponent(relativePath)}`;
}

export function buildPolicyFileByNameUrl(fileName, library = "") {
  const params = new URLSearchParams({ fileName: fileName || "" });
  if (library) params.set("library", library);
  return `${getEnterpriseApiUrl("/file-by-name")}?${params.toString()}`;
}
