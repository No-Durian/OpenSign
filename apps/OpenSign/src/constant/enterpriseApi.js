import axios from "axios";
import { serverUrl_fn } from "./appinfo";

export function getEnterpriseBaseUrl() {
  return serverUrl_fn().replace(/\/app\/?$/, "");
}

export function getEnterpriseApiUrl(path = "") {
  const base = getEnterpriseBaseUrl();
  return `${base}/enterprise${path}`;
}

export async function fetchEnterpriseConfig() {
  const { data } = await axios.get(getEnterpriseApiUrl("/config"));
  return data;
}
export async function fetchEnterpriseOverview() {
  const { data } = await axios.get(getEnterpriseApiUrl("/overview"));
  return data;
}

export async function fetchEnterpriseSearchOptions() {
  const { data } = await axios.get(getEnterpriseApiUrl("/search/options"));
  return data;
}

export async function searchPolicies(params) {
  const { data } = await axios.get(getEnterpriseApiUrl("/search"), { params });
  return data;
}

export async function fetchPolicyManagement() {
  const { data } = await axios.get(getEnterpriseApiUrl("/management"));
  return data;
}

export async function fetchPolicyMessages(role) {
  const { data } = await axios.get(getEnterpriseApiUrl("/messages"), {
    headers: {
      "x-enterprise-role": role || ""
    }
  });
  return data;
}

export async function postPolicyMessage(payload) {
  const { data } = await axios.post(getEnterpriseApiUrl("/messages"), payload);
  return data;
}

export async function fetchAiAssistantConfig() {
  const { data } = await axios.get(getEnterpriseApiUrl("/assistant"));
  return data;
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
