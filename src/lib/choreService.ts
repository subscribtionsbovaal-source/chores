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
  arrayUnion
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Task, User, Household, TaskInstance, Invitation } from '../types';

const TASKS_COLLECTION = 'tasks';
const USERS_COLLECTION = 'users';
const HOUSEHOLDS_COLLECTION = 'households';
const INSTANCES_COLLECTION = 'task_instances';

export const choreService = {
  // Households
  getHousehold: async (id: string) => {
    try {
      const docRef = doc(db, HOUSEHOLDS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as Household : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${HOUSEHOLDS_COLLECTION}/${id}`);
    }
  },

  createHousehold: async (name: string, userId: string) => {
    const id = doc(collection(db, HOUSEHOLDS_COLLECTION)).id;
    const household: Household = {
      id,
      name,
      createdBy: userId,
      members: [userId],
      admins: [userId], // Creator is Household Admin
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, HOUSEHOLDS_COLLECTION, id), household);
      await updateDoc(doc(db, USERS_COLLECTION, userId), { 
        householdIds: arrayUnion(id),
        currentHouseholdId: id 
      });
      return household;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, HOUSEHOLDS_COLLECTION);
    }
  },

  updateHousehold: async (id: string, data: Partial<Household>) => {
    try {
      await updateDoc(doc(db, HOUSEHOLDS_COLLECTION, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${HOUSEHOLDS_COLLECTION}/${id}`);
    }
  },

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

  // Tasks (Definitions)
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

  saveTask: async (task: Partial<Task>) => {
    const id = task.id || doc(collection(db, TASKS_COLLECTION)).id;
    const taskRef = doc(db, TASKS_COLLECTION, id);
    try {
      // Clean undefined values
      const data = { ...task, id };
      Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) delete (data as any)[key];
      });
      await setDoc(taskRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${TASKS_COLLECTION}/${id}`);
    }
  },

  // Task Instances (Occurrences)
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

  saveInstance: async (instance: Partial<TaskInstance>) => {
    const id = instance.id || doc(collection(db, INSTANCES_COLLECTION)).id;
    const instanceRef = doc(db, INSTANCES_COLLECTION, id);
    try {
      // Clean undefined values
      const data = { ...instance, id };
      Object.keys(data).forEach(key => {
        if ((data as any)[key] === undefined) delete (data as any)[key];
      });
      
      await setDoc(instanceRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${INSTANCES_COLLECTION}/${id}`);
    }
  },

  deleteInstance: async (id: string) => {
    try {
      await deleteDoc(doc(db, INSTANCES_COLLECTION, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${INSTANCES_COLLECTION}/${id}`);
    }
  },

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

  deleteTask: async (taskId: string) => {
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${TASKS_COLLECTION}/${taskId}`);
    }
  },

  // Users
  subscribeToHouseholdUsers: (householdId: string, callback: (users: User[]) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where('householdIds', 'array-contains', householdId));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    });
  },

  updateUser: async (id: string, data: Partial<User>) => {
    try {
      await updateDoc(doc(db, USERS_COLLECTION, id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COLLECTION}/${id}`);
    }
  },

  getAllUsers: async () => {
    try {
      const snapshot = await getDocs(collection(db, USERS_COLLECTION));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
    }
  },

  getAllHouseholds: async () => {
    try {
      const snapshot = await getDocs(collection(db, HOUSEHOLDS_COLLECTION));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Household));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, HOUSEHOLDS_COLLECTION);
    }
  },

  getUser: async (id: string) => {
    try {
      const docSnap = await getDoc(doc(db, USERS_COLLECTION, id));
      return docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as User : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${id}`);
    }
  },

  generateInvitationToken: async (householdId: string) => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    try {
      await updateDoc(doc(db, HOUSEHOLDS_COLLECTION, householdId), { invitationToken: token });
      return token;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${HOUSEHOLDS_COLLECTION}/${householdId}`);
    }
  },

  createInvitation: async (householdId: string, email: string, invitedBy: string) => {
    try {
      const household = await choreService.getHousehold(householdId);
      if (!household || !household.invitationToken) {
        throw new Error('Household does not have an active invitation token. Please generate one first.');
      }

      const id = doc(collection(db, 'invitations')).id;
      const createdAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(createdAt.getDate() + 3); // 3 days expiration

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

      await setDoc(doc(db, 'invitations', id), invitation);
      return invitation;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invitations');
      throw error;
    }
  },

  joinHouseholdByToken: async (token: string, userId: string, userEmail?: string) => {
    try {
      const q = query(collection(db, HOUSEHOLDS_COLLECTION), where('invitationToken', '==', token));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Invalid invitation link');
      }

      const householdDoc = snapshot.docs[0];
      const household = { ...householdDoc.data(), id: householdDoc.id } as Household;

      if (household.members.includes(userId)) {
        return household;
      }

      // If an email is provided, check if there's a specific invitation for it
      if (userEmail) {
        const invQ = query(
          collection(db, 'invitations'), 
          where('token', '==', token),
          where('email', '==', userEmail),
          where('status', '==', 'pending')
        );
        const invSnapshot = await getDocs(invQ);
        if (!invSnapshot.empty) {
          const invDoc = invSnapshot.docs[0];
          const invData = invDoc.data() as Invitation;
          
          // Check expiration
          if (new Date(invData.expiresAt) < new Date()) {
            await updateDoc(invDoc.ref, { status: 'expired' });
            throw new Error('Invitation has expired');
          }

          // Mark as accepted
          await updateDoc(invDoc.ref, { 
            status: 'accepted',
            acceptedAt: new Date().toISOString(),
            acceptedByUid: userId
          });
        }
      }

      // Update household members
      await updateDoc(doc(db, HOUSEHOLDS_COLLECTION, household.id), {
        members: arrayUnion(userId)
      });

      // Update user households
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        householdIds: arrayUnion(household.id),
        currentHouseholdId: household.id
      });

      // One-time use logic: Regenerate the token so the link used is now invalid
      await choreService.generateInvitationToken(household.id);

      return household;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, HOUSEHOLDS_COLLECTION);
      throw error;
    }
  },

  syncUserProfile: async (firebaseUser: any) => {
    const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    
    const isSystemAdmin = firebaseUser.email === "subscribtions.bovaal@gmail.com";

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
    } else {
      const existingData = userDoc.data() as User;
      // Ensure system admin role is synced if email matches
      if (isSystemAdmin && existingData.role !== 'system_admin') {
        await updateDoc(userRef, { role: 'system_admin' });
        return { ...existingData, role: 'system_admin' };
      }
      return existingData;
    }
  }
};
