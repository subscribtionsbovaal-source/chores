import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  deleteDoc,
  updateDoc,
  getDoc,
  arrayUnion,
  limit,
  deleteField
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Task, User, Household, TaskInstance, Invitation } from '../types';

// --- Firestore Collection Names ---
// These constants define the names of the collections in the Firestore database.
const TASKS_COLLECTION = 'tasks';
const USERS_COLLECTION = 'users';
const HOUSEHOLDS_COLLECTION = 'households';
const INSTANCES_COLLECTION = 'task_instances';

/**
 * choreService: A centralized service for interacting with the Firestore database.
 * This service handles all CRUD (Create, Read, Update, Delete) operations for
 * households, tasks, task instances, users, and invitations.
 */
export const choreService = {
  // --- Household Management ---
  // Functions for managing household data and membership.

  /**
   * Fetches a single household document by its ID.
   * @param id - The unique identifier of the household.
   * @returns The household data if found, or null if it doesn't exist.
   */
  getHousehold: async (id: string) => {
    try {
      const docRef = doc(db, HOUSEHOLDS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as Household : null;
    } catch (error) {
      // Log and throw a structured error for the AIS Agent to diagnose
      handleFirestoreError(error, OperationType.GET, `${HOUSEHOLDS_COLLECTION}/${id}`);
    }
  },

  /**
   * Creates a new household and assigns the creator as the first member and admin.
   * @param name - The display name of the new household.
   * @param userId - The ID of the user creating the household.
   * @returns The newly created household object.
   */
  createHousehold: async (name: string, userId: string) => {
    // Generate a new unique ID for the household
    const id = doc(collection(db, HOUSEHOLDS_COLLECTION)).id;
    const household: Household = {
      id,
      name,
      createdBy: userId,
      members: [userId],
      admins: [userId], // The creator is automatically granted Household Admin privileges
      createdAt: new Date().toISOString(),
    };
    try {
      // 1. Create the household document
      await setDoc(doc(db, HOUSEHOLDS_COLLECTION, id), household);
      // 2. Update the user's profile to include this new household ID
      await updateDoc(doc(db, USERS_COLLECTION, userId), { 
        householdIds: arrayUnion(id),
        currentHouseholdId: id 
      });
      return household;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, HOUSEHOLDS_COLLECTION);
    }
  },

  /**
   * Updates an existing household's metadata (e.g., name, admin list).
   * @param id - The ID of the household to update.
   * @param data - Partial household data containing the fields to change.
   */
  updateHousehold: async (id: string, data: Partial<Household>) => {
    try {
      await updateDoc(doc(db, HOUSEHOLDS_COLLECTION, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${HOUSEHOLDS_COLLECTION}/${id}`);
    }
  },

  /**
   * Sets up a real-time listener for a specific household document.
   * @param id - The ID of the household to listen to.
   * @param callback - Function called whenever the household data changes.
   * @returns An unsubscribe function to stop listening.
   */
  subscribeToHousehold: (id: string, callback: (household: Household | null) => void) => {
    const docRef = doc(db, HOUSEHOLDS_COLLECTION, id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ ...docSnap.data(), id: docSnap.id } as Household);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${HOUSEHOLDS_COLLECTION}/${id}`);
    });
  },

  // --- Task Definitions (Templates) ---
  // Functions for managing the "blueprints" of tasks (recurrence, title, etc.).

  /**
   * Listens to all task definitions within a specific household.
   * Tasks are the "blueprints" for chores, containing recurrence rules.
   * We order by 'createdAt' to ensure the most recently created tasks appear first in UI lists.
   * @param householdId - The ID of the household whose tasks to fetch.
   * @param callback - Function called with the updated list of tasks.
   * @returns An unsubscribe function to stop the real-time listener.
   */
  subscribeToTasks: (householdId: string, callback: (tasks: Task[]) => void) => {
    const q = query(
      collection(db, TASKS_COLLECTION), 
      where('householdId', '==', householdId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      callback(tasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, TASKS_COLLECTION);
    });
  },

  /**
   * Saves or updates a task template (blueprint).
   * This function uses { merge: true } to allow partial updates (e.g., updating just the title).
   * It also sanitizes the data by removing undefined fields, as Firestore will throw an error
   * if it encounters an 'undefined' property in a document write.
   * @param task - The task blueprint data. If 'id' is missing, a new one is generated.
   */
  saveTask: async (task: Partial<Task>) => {
    const id = task.id || doc(collection(db, TASKS_COLLECTION)).id;
    const taskRef = doc(db, TASKS_COLLECTION, id);
    try {
      const data = { ...task, id };
      Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) delete (data as any)[key];
      });
      await setDoc(taskRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${TASKS_COLLECTION}/${id}`);
    }
  },

  // --- Task Instances (Calendar Occurrences) ---
  // Functions for managing specific instances of tasks assigned to dates.

  /**
   * Listens to all task instances (calendar entries) for a household.
   * These records drive the visual rendering of the calendar.
   * @param householdId - The ID of the household.
   * @param callback - Function called with the updated list of instances.
   * @returns An unsubscribe function.
   */
  subscribeToInstances: (householdId: string, callback: (instances: TaskInstance[]) => void) => {
    const q = query(
      collection(db, INSTANCES_COLLECTION),
      where('householdId', '==', householdId)
    );
    return onSnapshot(q, (snapshot) => {
      const instances = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TaskInstance));
      callback(instances);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, INSTANCES_COLLECTION);
    });
  },

  /**
   * Saves or updates a specific task instance (calendar occurrence).
   * Used for things like assigning a user to a specific date of a chore.
   * @param instance - The occurrence data.
   */
  saveInstance: async (instance: Partial<TaskInstance>) => {
    const id = instance.id || doc(collection(db, INSTANCES_COLLECTION)).id;
    const instanceRef = doc(db, INSTANCES_COLLECTION, id);
    try {
      const data = { 
        status: 'to do' as const,
        ...instance, 
        id 
      };
      Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) delete (data as any)[key];
      });
      
      await setDoc(instanceRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${INSTANCES_COLLECTION}/${id}`);
    }
  },

  /**
   * Toggles completion status for a specific occurrence of a chore.
   * This is a fundamental "instant" action. When marking as 'done', we record
   * exactly who did it and when for accountability and future reporting.
   * @param instanceId - The unique calendar instance ID.
   * @param currentStatus - Current state to toggle away from.
   * @param userId - The performing user's ID.
   */
  toggleInstanceStatus: async (instanceId: string, currentStatus: 'to do' | 'done', userId: string) => {
    const instanceRef = doc(db, INSTANCES_COLLECTION, instanceId);
    const newStatus = currentStatus === 'to do' ? 'done' : 'to do';
    try {
      // updateDoc is used here as a targeted write to these specific fields.
      await updateDoc(instanceRef, {
        status: newStatus,
        completedAt: newStatus === 'done' ? new Date().toISOString() : deleteField(),
        completedBy: newStatus === 'done' ? userId : deleteField()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${INSTANCES_COLLECTION}/${instanceId}`);
    }
  },

  /**
   * Deletes a specific task instance from the calendar.
   * @param id - The ID of the instance to delete.
   */
  deleteInstance: async (id: string) => {
    try {
      await deleteDoc(doc(db, INSTANCES_COLLECTION, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${INSTANCES_COLLECTION}/${id}`);
    }
  },

  /**
   * Deletes all instances associated with a parent task definition.
   * Useful when a recurring task is deleted entirely.
   * @param taskId - The ID of the parent task.
   */
  deleteInstancesByTaskId: async (taskId: string) => {
    try {
      const q = query(collection(db, INSTANCES_COLLECTION), where('taskId', '==', taskId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, INSTANCES_COLLECTION);
    }
  },

  /**
   * Deletes a task definition template.
   * @param taskId - The ID of the task to delete.
   */
  deleteTask: async (taskId: string) => {
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${TASKS_COLLECTION}/${taskId}`);
    }
  },

  // --- User Profile & Membership ---
  // Functions for managing user data and their relationship to households.

  /**
   * Listens to all users who are members of a specific household.
   * @param householdId - The ID of the household.
   * @param callback - Function called with the list of member users.
   * @returns An unsubscribe function.
   */
  subscribeToHouseholdUsers: (householdId: string, callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where('householdIds', 'array-contains', householdId));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    });
  },

  /**
   * Listens to a single user's profile for real-time updates.
   * @param id - The user ID.
   * @param callback - Function called with the updated user data.
   * @returns An unsubscribe function.
   */
  subscribeToUserProfile: (id: string, callback: (user: User | null) => void) => {
    const docRef = doc(db, USERS_COLLECTION, id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ ...docSnap.data(), id: docSnap.id } as User);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${id}`);
    });
  },

  /**
   * Updates a user's profile data.
   * @param id - The unique ID of the user.
   * @param data - Partial user data to update.
   */
  updateUser: async (id: string, data: Partial<User>) => {
    try {
      // 1. Fetch the existing document to ensure we have the complete dataset
      const userRef = doc(db, USERS_COLLECTION, id);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const existingData = userDoc.data() as User;

      // 2. Merge existing data with new updates
      // We clean the incoming data of undefined values first
      const updates = { ...data };
      Object.keys(updates).forEach(key => {
        if ((updates as any)[key] === undefined) delete (updates as any)[key];
      });

      const fullData: User = {
        ...existingData,
        ...updates,
        id // Ensure ID remains consistent
      };
      
      // 3. Perform a full update (setDoc) to satisfy integrity requirements in security rules.
      // This ensures request.resource.data in Firestore rules is the complete object,
      // avoiding "Missing or insufficient permissions" errors caused by partial updates
      // failing schema validation.
      await setDoc(userRef, fullData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${id}`);
    }
  },

  /**
   * Fetches all users in the system.
   * Restricted: Usually only callable by System Admins via security rules.
   * @returns A list of all users.
   */
  getAllUsers: async () => {
    try {
      const snapshot = await getDocs(collection(db, USERS_COLLECTION));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    }
  },

  /**
   * Fetches all households in the system.
   * Restricted: Usually only callable by System Admins via security rules.
   * @returns A list of all households.
   */
  getAllHouseholds: async () => {
    try {
      const snapshot = await getDocs(collection(db, HOUSEHOLDS_COLLECTION));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Household));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, HOUSEHOLDS_COLLECTION);
    }
  },

  /**
   * Fetches a single user's profile by ID.
   * @param id - The user ID.
   * @returns The user data or null.
   */
  getUser: async (id: string) => {
    try {
      const docSnap = await getDoc(doc(db, USERS_COLLECTION, id));
      return docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as User : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${id}`);
    }
  },

  // --- Invitation & Joining System ---
  // Functions for generating invite links and processing new members.

  /**
   * Generates a new random invitation token for a household.
   * This token is used in the URL to identify the household to join.
   * @param householdId - The ID of the household.
   * @returns The generated token string.
   */
  generateInvitationToken: async (householdId: string) => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    try {
      await updateDoc(doc(db, HOUSEHOLDS_COLLECTION, householdId), { invitationToken: token });
      return token;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${HOUSEHOLDS_COLLECTION}/${householdId}`);
    }
  },

  /**
   * Creates a specific invitation record for an email address.
   * This allows tracking who was invited and ensuring they use the correct link.
   * @param householdId - The ID of the household.
   * @param email - The email address of the person being invited.
   * @param invitedBy - The ID of the user sending the invite.
   * @returns The created invitation object.
   */
  createInvitation: async (householdId: string, email: string, invitedBy: string) => {
    try {
      // 1. Ensure the household has an active token
      const household = await choreService.getHousehold(householdId);
      if (!household || !household.invitationToken) {
        throw new Error('Household does not have an active invitation token. Please generate one first.');
      }

      const id = doc(collection(db, 'invitations')).id;
      const createdAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(createdAt.getDate() + 3); // Invitations expire after 3 days

      const invitation: Invitation = {
        id,
        token: household.invitationToken,
        householdId,
        email,
        role: 'user',
        status: 'pending',
        invitedBy,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      };

      // 2. Save the invitation document
      await setDoc(doc(db, 'invitations', id), invitation);
      return invitation;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invitations');
      throw error;
    }
  },

  /**
   * Processes a user joining a household using an invitation token.
   * This is a multi-step process that updates both the household and the user's profile.
   * @param token - The invitation token from the URL.
   * @param userId - The ID of the user who is joining.
   * @param userEmail - Optional email to verify against specific invitations.
   * @returns The household object that was joined.
   */
  joinHouseholdByToken: async (token: string, userId: string, userEmail?: string) => {
    console.log(`[joinHouseholdByToken] Starting join process for user ${userId} with token ${token}`);
    try {
      // 1. Find the household that owns this token.
      // Security rules require limit(1) to prevent broad scanning.
      const q = query(
        collection(db, HOUSEHOLDS_COLLECTION), 
        where('invitationToken', '==', token),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.error('[joinHouseholdByToken] No household found with token:', token);
        throw new Error('Invalid invitation link');
      }

      const householdDoc = snapshot.docs[0];
      const household = { ...householdDoc.data(), id: householdDoc.id } as Household;
      console.log(`[joinHouseholdByToken] Found household: ${household.name} (${household.id})`);

      // 2. Check if the user is already a member
      if (household.members.includes(userId)) {
        console.log('[joinHouseholdByToken] User is already a member. Ensuring currentHouseholdId is set.');
        await updateDoc(doc(db, USERS_COLLECTION, userId), {
          currentHouseholdId: household.id
        });
        return household;
      }

      // 3. If an email is provided, check for a matching pending invitation
      if (userEmail) {
        console.log(`[joinHouseholdByToken] Checking for specific invitation for ${userEmail}`);
        const invQ = query(
          collection(db, 'invitations'), 
          where('token', '==', token),
          where('email', '==', userEmail),
          where('status', '==', 'pending'),
          limit(1)
        );
        const invSnapshot = await getDocs(invQ);
        if (!invSnapshot.empty) {
          const invDoc = invSnapshot.docs[0];
          const invData = invDoc.data() as Invitation;
          
          // Check for expiration
          if (new Date(invData.expiresAt) < new Date()) {
            console.warn('[joinHouseholdByToken] Specific invitation expired');
            await updateDoc(invDoc.ref, { status: 'expired' });
            throw new Error('Invitation has expired');
          }

          // Mark the invitation as accepted
          console.log('[joinHouseholdByToken] Accepting specific invitation');
          await updateDoc(invDoc.ref, { 
            status: 'accepted',
            acceptedAt: new Date().toISOString(),
            acceptedByUid: userId
          });
        }
      }

      // 4. Update the Household's member list
      console.log(`[joinHouseholdByToken] Attempting to add user ${userId} to household ${household.id} members...`);
      await updateDoc(doc(db, HOUSEHOLDS_COLLECTION, household.id), {
        members: arrayUnion(userId)
      });

      // 5. Update the User's profile to include the new household
      console.log(`[joinHouseholdByToken] Attempting to update user profile for ${userId}...`);
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        householdIds: arrayUnion(household.id),
        currentHouseholdId: household.id
      });

      console.log('[joinHouseholdByToken] Join successful!');
      return household;
    } catch (error) {
      console.error('[joinHouseholdByToken] Error:', error);
      handleFirestoreError(error, OperationType.UPDATE, HOUSEHOLDS_COLLECTION);
      throw error;
    }
  },

  /**
   * Synchronizes the local Firestore user profile with the Firebase Auth user.
   * This is a critical function for security and data integrity.
   * Logic:
   * 1. Check if a profile exists for the UID.
   * 2. If new: Create a profile with default values (random color, 'user' role).
   * 3. If existing: 
   *    - Enforce 'system_admin' role if the email matches the hardcoded admin email.
   *    - Backfill any missing fields that might have been omitted in older versions (schema migration).
   *    - Sync only if changes are detected to preserve write quotas.
   * @param firebaseUser - The credentials object from onAuthStateChanged.
   * @returns The fully populated {@link User} profile.
   */
  syncUserProfile: async (firebaseUser: any) => {
    const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    
    // Check if this user is the designated System Administrator
    const isSystemAdmin = firebaseUser.email === "subscribtions.bovaal@gmail.com";

    // Case 1: User is logging in for the first time (No Firestore document)
    if (!userDoc.exists()) {
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Family Member',
        email: firebaseUser.email || '',
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        role: isSystemAdmin ? 'system_admin' : 'user',
        householdIds: [],
      };
      try {
        await setDoc(userRef, newUser);
        return newUser;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${USERS_COLLECTION}/${firebaseUser.uid}`);
      }
    } 
    // Case 2: User already exists in Firestore
    else {
      const existingData = userDoc.data() as User;
      const updates: any = {};
      
      // Enforce System Admin role if the email matches the admin email
      if (isSystemAdmin && existingData.role !== 'system_admin') {
        updates.role = 'system_admin';
      }
      
      // Backfill missing required fields for older accounts to satisfy security rules
      if (!existingData.id) updates.id = firebaseUser.uid;
      if (!existingData.householdIds) updates.householdIds = [];
      if (!existingData.color) updates.color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      
      // Only perform a write if there are actual changes to sync
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        return { ...existingData, ...updates };
      }
      
      return existingData;
    }
  }
};