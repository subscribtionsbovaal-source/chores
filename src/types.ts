/**
 * Represents the global access level of a user within the entire system.
 * 'system_admin' has total oversight across all groups.
 * 'user' is restricted to their assigned groups.
 */
export type GlobalRole = 'system_admin' | 'user' | 'ADMIN' | 'MEMBER';

/**
 * Represents group-specific profile overrides.
 */
export interface UserGroupSettings {
  /** The display name used within this specific group. */
  name?: string;
  /** The color used for this user within this specific group. */
  color?: string;
}

/**
 * Represents a user profile in the system.
 * This is the primary identity object linked to Firebase Authentication.
 */
export interface User {
  /** The unique numeric ID in Supabase. */
  id: number;
  /** The unique Supabase Auth UUID (Auth ID). */
  authId: string;
  /** The global display name chosen by the user or synced. */
  name: string;
  /** The user's verified email address. */
  email: string;
  /** Optional URL to a hosted avatar image. */
  avatar?: string;
  /** The global hexadecimal color code used for UI personalization. */
  color: string;
  /** See {@link GlobalRole} for permission levels. */
  role: GlobalRole;
  /** The ID of the group currently being viewed by the user. */
  currentGroupId?: number;
  /** Whether the user is a system admin. */
  isSysAdmin: boolean;
}

/**
 * Represents a collection of users sharing tasks and schedules.
 * A group acts as a logical container for all collaborative data.
 */
export interface Group {
  /** Unique identifier for the group. */
  id: number;
  /** Display name of the group (e.g., "The Smiths"). */
  name: string;
  /** ID of the user who initially created the group. */
  createdBy: number;
  /** Array of User IDs who belong to this group (computed or separate query). */
  members?: number[];
  /** ISO 8601 timestamp of when the group was created. */
  createdAt: string;
  /** A random string used in invitation URLs. */
  invitationToken?: string;
}

// Removed Household alias in favor of Group

/**
 * Represents a specific invite sent to an email address.
 * Used for tracking and securing the onboarding of new family members.
 */
export interface Invitation {
  /** Unique ID for the invitation record. */
  id: string;
  /** The random token associated with the target {@link Group}. */
  token: string;
  /** The ID of the {@link Group} the invite is for. */
  groupId: string;
  /** The target email address for this invite. */
  email: string;
  /** The role intended for the new user (default is usually 'user'). */
  role: string;
  /** Current state: 'pending', 'accepted', 'expired', or 'revoked'. */
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  /** UID of the user who generated the invite. */
  invitedBy: string;
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
  /** ISO 8601 timestamp of when this specific invite ceases to be valid. */
  expiresAt: string;
  /** ISO 8601 timestamp of when the user accepted. */
  acceptedAt?: string;
  /** The UID of the user who claimed this invitation. */
  acceptedByUid?: string;
}

/**
 * Defines the frequency patterns for task repetitions.
 * 'none': Single occurrence.
 * 'daily': Repeats every day.
 * 'weekly': Repeats on specific days of the week.
 * 'monthly': Repeats on the same day every month.
 * 'custom': Allows for complex interval and day-of-week logic.
 */
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Defines the "blueprint" of a task.
 * Does not represent a specific calendar entry, but the template used to generate them.
 */
export interface Task {
  /** Unique ID for the task template. */
  id: number;
  /** Reference to the {@link Group} this task belongs to. */
  groupId: number;
  /** Title of the chore or activity. */
  title: string;
  /** Detailed instructions or notes for the performer. */
  description?: string;
  /** Whether the task is recurring. */
  isRecurring: boolean;
  /** rrule string for recurrence. */
  rrule?: string;
  /** Start date for the task pattern. */
  startDate?: string;
  /** ISO 8601 string for when the repetition pattern should stop. */
  endDate?: string;
  /** ID of the user assigned to this template. */
  assignedTo?: number;
  /** Priority level. */
  priority: 'LOW' | 'REGULAR' | 'HIGH';
  /** ID of the creator. */
  createdBy: number;
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
}

/**
 * Represents a single occurrence of a task on the calendar.
 */
export interface TaskInstance {
  /** Unique ID for this specific calendar occurrence. */
  id: number;
  /** Reference to the parent {@link Task} blueprint. */
  taskId: number;
  /** Reference to the owner {@link Group}. (In Supabase, this is often joined from Task) */
  groupId: number;
  /** The specific ISO 8601 date/time this instance is scheduled for. */
  dueDate: string;
  /** The ID of the user assigned to this specific occurrence. */
  assignedTo?: number | null;
  /** ISO 8601 timestamp of completion. */
  completedAt?: string | null;
  /** ID of the user who marked it as done. */
  completedBy?: number | null;
  /** The current state: 'TO DO', 'IN PROGRESS', or 'DONE'. */
  status: 'TO DO' | 'IN PROGRESS' | 'DONE';
  /** Priority override. */
  priority: 'LOW' | 'REGULAR' | 'HIGH';
  /** Title override. */
  title?: string;
  /** Description override. */
  description?: string;
  /** Whether the parent task is recurring. */
  isRecurring?: boolean;
  /** ISO 8601 timestamp of creation. */
  createdAt?: string;
}
