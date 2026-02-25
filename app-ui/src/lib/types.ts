export interface User {
  id: number;
  username: string;
  display_name?: string;
  is_admin: boolean;
  encryption_key?: string;
  created_at: string;
}

export interface ServerInfo {
  status: string;
  server_name: string;
  paused?: boolean;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  encrypted: boolean;
  iv?: string;
  created_at: string;
}

export interface Model {
  name: string;
  details: {
    parameter_size: string;
    quantization_level?: string;
    family?: string;
  };
  size?: number;
}

export interface RunningModel {
  name: string;
  size: number;
}

export interface Invite {
  id: number;
  token: string;
  max_uses: number;
  uses: number;
  expires_at?: string;
  created_at: string;
}

export interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  last_used_at?: string;
  created_at: string;
}

export interface AdminStats {
  users: number;
  messages_today: number;
  models: number;
  active_sessions: number;
}

export interface HardwareInfo {
  total_ram: number;
  available_ram: number;
  cpu_cores: number;
  cpu_model: string;
  gpu_info: string;
  gpu_memory: number;
  os: string;
  arch: string;
}

export interface CatalogModelVariant {
  tag: string;
  parameters: string;
  size_gb: number;
  ram_gb: number;
}

export interface CatalogModel {
  name: string;
  description: string;
  category: string;
  variants: CatalogModelVariant[];
}

