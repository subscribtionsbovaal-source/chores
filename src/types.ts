export type GlobalRole = 'system_admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  role: GlobalRole;
  householdIds: string[];
  currentHouseholdId?: string;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // User IDs
  admins: string[]; // User IDs - Household Admins
  createdAt: string;
  invitationToken?: string;
}

export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Task {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  recurrence: TaskRecurrence;
  interval?: number; // For custom recurrence (e.g., every 2 weeks)
  weekDays?: number[]; // 0-6, where 0 is Sunday
  recurrenceEndDate?: string; // ISO string
  createdBy: string;
  createdAt: string;
}

export interface TaskInstance {
  id: string;
  taskId: string;
  householdId: string;
  dueDate: string; // ISO string
  assignedTo?: string | null; // User ID
  completedAt?: string;
  completedBy?: string;
}
