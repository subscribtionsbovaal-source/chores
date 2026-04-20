/**
 * Represents the global access level of a user within the entire system.
 * 'system_admin' has total oversight across all households.
 * 'user' is restricted to their assigned households.
 */
export type GlobalRole = 'system_admin' | 'user';

/**
 * Represents a user profile in the system.
 * This is the primary identity object linked to Firebase Authentication.
 */
export interface User {
  /** The unique Firebase Auth UID. */
  id: string;
  /** The display name chosen by the user or synced from Google. */
  name: string;
  /** The user's verified email address. */
  email: string;
  /** Optional URL to a hosted avatar image. */
  avatar?: string;
  /** A hexadecimal color code used for UI personalization (e.g., calendar tags). */
  color: string;
  /** See {@link GlobalRole} for permission levels. */
  role: GlobalRole;
  /** List of IDs for households the user is a member of. */
  householdIds: string[];
  /** The ID of the household currently being viewed by the user. */
  currentHouseholdId?: string;
}

/**
 * Represents a collection of users sharing tasks and schedules.
 * A household acts as a logical container for all collaborative data.
 */
export interface Household {
  /** Unique identifier for the household. */
  id: string;
  /** Display name of the family or group (e.g., "The Smiths"). */
  name: string;
  /** UID of the user who initially created the household. */
  createdBy: string;
  /** Array of User IDs who belong to this household. */
  members: string[];
  /** Array of User IDs with administrative rights within this specific household. */
  admins: string[];
  /** ISO 8601 timestamp of when the household was created. */
  createdAt: string;
  /** A random string used in invitation URLs to allow new members to join. */
  invitationToken?: string;
}

/**
 * Represents a specific invite sent to an email address.
 * Used for tracking and securing the onboarding of new family members.
 */
export interface Invitation {
  /** Unique ID for the invitation record. */
  id: string;
  /** The random token associated with the target {@link Household}. */
  token: string;
  /** The ID of the {@link Household} the invite is for. */
  householdId: string;
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
  id: string;
  /** Reference to the {@link Household} this task belongs to. */
  householdId: string;
  /** Title of the chore or activity. */
  title: string;
  /** Detailed instructions or notes for the performer. */
  description?: string;
  /** The repetition interval. See {@link TaskRecurrence}. */
  recurrence: TaskRecurrence;
  /** Number representing frequency (e.g., interval of 2 with 'weekly' means "every 2 weeks"). */
  interval?: number;
  /** Array of numbers (0-6) representing Sunday through Saturday for custom recurrence. */
  weekDays?: number[];
  /** ISO 8601 string for when the repetition pattern should stop generating instances. */
  recurrenceEndDate?: string;
  /** UID of the creator. */
  createdBy: string;
  /** ISO 8601 timestamp of when the blueprint was defined. */
  createdAt: string;
}

/**
 * Represents a single occurrence of a task on the calendar.
 * Multiple instances can be linked to a single {@link Task} blueprint via 'taskId'.
 */
export interface TaskInstance {
  /** Unique ID for this specific calendar occurrence. */
  id: string;
  /** Reference to the parent {@link Task} blueprint. */
  taskId: string;
  /** Reference to the owner {@link Household}. */
  householdId: string;
  /** The specific ISO 8601 date/time this instance is scheduled for. */
  dueDate: string;
  /** The UID of the user assigned to this specific occurrence (null if unassigned). */
  assignedTo?: string | null;
  /** ISO 8601 timestamp of completion. */
  completedAt?: string;
  /** UID of the user who marked it as done. */
  completedBy?: string;
  /** The current state: 'to do' (active) or 'done' (completed). */
  status: 'to do' | 'done';
}
