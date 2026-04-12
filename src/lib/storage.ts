import { Task, User } from '../types';

const TASKS_KEY = 'family_chore_tasks';
const USERS_KEY = 'family_chore_users';

// Default users for the demo
const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Mom', email: 'mom@example.com', color: '#ec4899', role: 'user', householdIds: [] },
  { id: '2', name: 'Dad', email: 'dad@example.com', color: '#3b82f6', role: 'user', householdIds: [] },
  { id: '3', name: 'Alex', email: 'alex@example.com', color: '#10b981', role: 'user', householdIds: [] },
  { id: '4', name: 'Sam', email: 'sam@example.com', color: '#f59e0b', role: 'user', householdIds: [] },
];

export const storage = {
  getTasks: (): Task[] => {
    const data = localStorage.getItem(TASKS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveTasks: (tasks: Task[]) => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  },
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(data);
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};
