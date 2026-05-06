/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials missing. Please check your environment variables in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseUser = {
  id: number;
  email: string;
  name: string;
  current_group_id: number;
  updated_at: string;
  created_at: string;
  is_sysadmin: boolean;
  color: string;
  auth_id: string;
};

export type SupabaseGroup = {
  id: number;
  name: string;
  invitation_token: string;
  created_at: string;
  created_by: number;
};

export type SupabaseGroupMember = {
  group_id: number;
  user_id: number;
  joined_at: string;
  role: 'MEMBER' | 'ADMIN';
};

export type TaskStatus = 'TO DO' | 'IN PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'REGULAR' | 'HIGH';

export type SupabaseTask = {
  id: number;
  group_id: number;
  created_by: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  rrule: string | null;
  is_recurring: boolean | null;
  created_at: string;
  assigned_to: number | null;
  priority: TaskPriority;
};

export type SupabaseTaskInstance = {
  id: number;
  task_id: number;
  created_at: string;
  due_date: string | null;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: number | null;
  title_override: string | null;
  description_override: string | null;
  assigned_to_override: number | null;
  priority_override: TaskPriority | null;
};
