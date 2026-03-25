export const DEFAULT_LIBRARY_PATH = 'C:/Users/TCT/Desktop/制度/制度内容';
export const DEFAULT_EXPIRY_PATH = 'C:/Users/TCT/Desktop/制度/检查过期文件';
export const DEFAULT_MANAGEMENT_PATH = 'C:/Users/TCT/Desktop/制度/制度管理';
export const DEFAULT_AI_URL = 'http://172.18.66.18/chat/rmh1ZG3tZOU30MdH';

export function getEnterpriseConfig() {
  return {
    libraryRoot: process.env.ENTERPRISE_POLICY_LIBRARY_PATH || DEFAULT_LIBRARY_PATH,
    expiryRoot: process.env.ENTERPRISE_POLICY_EXPIRY_PATH || DEFAULT_EXPIRY_PATH,
    managementRoot: process.env.ENTERPRISE_POLICY_MANAGEMENT_PATH || DEFAULT_MANAGEMENT_PATH,
    aiAssistantUrl: process.env.ENTERPRISE_AI_ASSISTANT_URL || DEFAULT_AI_URL,
  };
}
