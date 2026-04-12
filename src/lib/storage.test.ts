import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';
import { Task } from '../types';

describe('Storage Logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default users if none exist', () => {
    const users = storage.getUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users[0].name).toBe('Mom');
  });

  it('should save and retrieve tasks', () => {
    const mockTask: Task = {
      id: 'test-1',
      householdId: 'h1',
      title: 'Test Task',
      recurrence: 'none',
      createdBy: '1',
      createdAt: new Date().toISOString(),
    };

    storage.saveTasks([mockTask]);
    const tasks = storage.getTasks();
    
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Test Task');
  });

  it('should handle empty tasks', () => {
    const tasks = storage.getTasks();
    expect(tasks).toEqual([]);
  });
});
