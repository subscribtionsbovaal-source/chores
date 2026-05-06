/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { TaskDialog } from './components/TaskDialog';
import { SettingsModal } from './components/SettingsModal';
import { choreService } from './lib/choreService';
import { supabase } from './lib/supabase';
import { Task, User, TaskInstance, Group } from './types';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Users, Settings, Bell, LogIn, Plus, ChevronDown, Home, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDays, addWeeks, addMonths, isBefore, parseISO, format, startOfWeek, differenceInWeeks, getDay, differenceInCalendarWeeks, isSameDay, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The root Application component.
 * It manages the primary application lifecycle, including:
 * 1. Firebase Authentication & User Profile synchronization.
 * 2. Group selection and real-time data subscription.
 * 3. Dynamic generation of task instances based on recurrence templates.
 * 4. Modal state management for task creation and group settings.
 */
export default function App() {
  // --- State Management: Domain Data ---
  /** All available task blueprints (templates) for the selected group. */
  const [tasks, setTasks] = useState<Task[]>([]);
  /** All specific calendar occurrences (instances) for the group. */
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  /** List of all users (family members) belonging to the current group. */
  const [users, setUsers] = useState<User[]>([]);
  
  // --- State Management: Auth & Context ---
  /** The core Supabase Auth user credentials. */
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  /** The detailed Supabase user profile data. See {@link User}. */
  const [userProfile, setUserProfile] = useState<User | null>(null);
  /** The group currently in focus for the user. */
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  /** List of all groups the user belongs to. */
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  /** Tracks if initial authentication state has been resolved. */
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // --- State Management: UI/Navigation ---
  const [newGroupName, setNewGroupName] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<TaskInstance | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<string | null>(() => {
    // --- Invitation Token Initialization ---
    // Try to get from URL first
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get('invite');
      if (inviteToken) {
        sessionStorage.setItem('pendingInvite', inviteToken);
        return inviteToken;
      }
      // Fallback to session storage
      return sessionStorage.getItem('pendingInvite');
    }
    return null;
  });

  // --- URL Invitation Handler ---
  // Capture invite token from URL on mount and clean URL
  useEffect(() => {
    const handleUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get('invite');
      if (inviteToken) {
        setPendingInvite(inviteToken);
        sessionStorage.setItem('pendingInvite', inviteToken);
        // Clean URL immediately
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleUrl();
    // Listen for URL changes (e.g. if user clicks link while app is open)
    window.addEventListener('popstate', handleUrl);
    return () => window.removeEventListener('popstate', handleUrl);
  }, []);

  // --- Authentication State Listener ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    // Support for popup-based authentication success messaging
    const handleAuthMessage = (event: MessageEvent) => {
      // Validate origin is from this application
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'AUTH_COMPLETE') {
        console.log('Authentication complete message received from popup.');
        // The onAuthStateChange listener above will pick up the new session 
        // because Supabase stores it in LocalStorage (shared across tabs of same origin).
        // However, we explicitly refresh the session to be sure.
        supabase.auth.refreshSession();
      }
    };
    window.addEventListener('message', handleAuthMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  const handleSignIn = async () => {
    try {
      console.log('Initiating Google Sign-In via Popup...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Use our new callback route to close the popup gracefully
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true, // This allows us to open the URL in a separate popup
          queryParams: {
            prompt: 'select_account', // Better UX for multiple accounts
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Calculate centered popup position
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.url,
          'google_auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,status=no,location=no`
        );

        if (!popup) {
          alert('Popup blocked! Please allow popups for this site to sign in.');
        }
      }
    } catch (error) {
      console.error('Sign-in failed:', error);
      alert('Authentication failed. If you see a 403 error, please try opening the app in a New Tab.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // --- Profile Synchronization & Real-time Subscription ---
  // This effect ensures that the user's profile is synced with Auth and
  // that we listen for real-time changes (e.g. from SettingsModal).
  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    let active = true;
    let unsub: (() => void) | undefined;
    
    const setup = async () => {
      if (!active) return;

      // Ensure profile exists and is synced
      const profile = await choreService.syncUserProfile(currentUser);
      if (profile && active) {
        setUserProfile(profile);
        setUserDisplayName(profile.name);
        // Subscribe to real-time profile updates
        unsub = choreService.subscribeToUserProfile(profile.id, (p) => {
          if (active) setUserProfile(p);
        });
      }
    };
    
    setup();

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [currentUser]);

  // --- Group Invitation Process ---
  // Handle Invitation Link
  useEffect(() => {
    if (currentUser && userProfile && pendingInvite && !isJoining) {
      const joinGroup = async () => {
        console.log("[App] Starting joinGroup process...");
        setIsJoining(true);
        try {
          const group = await choreService.joinGroupByToken(pendingInvite, userProfile.id);
          if (group) {
            console.log("[App] Successfully joined group, refreshing profile...");
            // Refresh profile
            const updatedProfile = await choreService.getUser(userProfile.id);
            if (updatedProfile) {
              setUserProfile(updatedProfile);
            }
          }
        } catch (error) {
          console.error("[App] Failed to join group:", error);
        } finally {
          sessionStorage.removeItem('pendingInvite');
          setPendingInvite(null);
          setIsJoining(false);
        }
      };
      joinGroup();
    }
  }, [currentUser, userProfile?.id, pendingInvite]);

  // --- Real-time Data Listeners ---
  useEffect(() => {
    if (!userProfile) {
      setUserGroups([]);
      return;
    }

    const unsub = choreService.subscribeToUserGroups(userProfile.id, setUserGroups);
    return () => unsub();
  }, [userProfile?.id]);

  useEffect(() => {
    // If we have groups but none is selected, auto-select the first one
    if (userGroups.length > 0 && !userProfile?.currentGroupId && userProfile && !isCreatingNewGroup) {
      choreService.updateUser(userProfile.id, { currentGroupId: userGroups[0].id });
      return;
    }

    if (!userProfile?.currentGroupId) {
      setTasks([]);
      setInstances([]);
      setUsers([]);
      setCurrentGroup(null);
      return;
    }

    const groupId = userProfile.currentGroupId;
    
    const unsubGroup = choreService.subscribeToGroup(groupId, setCurrentGroup);
    const unsubTasks = choreService.subscribeToTasks(groupId, setTasks);
    const unsubInstances = choreService.subscribeToInstances(groupId, setInstances);
    const unsubUsers = choreService.subscribeToGroupUsers(groupId, setUsers);

    return () => {
      unsubGroup();
      unsubTasks();
      unsubInstances();
      unsubUsers();
    };
  }, [currentUser, userProfile?.currentGroupId]);

  // --- Group Switching Handler ---
  const handleSwitchGroup = async (groupId: number) => {
    if (!userProfile) return;
    setIsCreatingNewGroup(false);
    if (userProfile.currentGroupId === groupId) return;
    
    try {
      await choreService.updateUser(userProfile.id, { currentGroupId: groupId });
    } catch (error) {
      console.error("Failed to switch group:", error);
    }
  };

  // --- Group Creation Handler ---
  const handleCreateGroup = async () => {
    if (!userProfile || !newGroupName.trim() || !userDisplayName.trim()) return;
    try {
      // Use the new onboarding completion method which creates group + membership + updates name
      const group = await choreService.completeOnboarding(
        userProfile.id, 
        newGroupName.trim(),
        userDisplayName.trim()
      );
      if (group) {
        setIsCreatingNewGroup(false);
        // Refresh profile to reflect the new currentGroupId and potentially updated name
        const updatedProfile = await choreService.getUser(userProfile.id);
        setUserProfile(updatedProfile);
        setNewGroupName(''); // Reset input for future use
      }
    } catch (error) {
      console.error("Failed to setup group during onboarding:", error);
      alert('Failed to complete onboarding. Please try again.');
    }
  };

  // --- Task Interaction Handlers ---
  /**
   * Prepares the state for adding a new task.
   * Resets the selected instance and sets a target date for the modal.
   */
  const handleAddTask = (date: Date) => {
    setSelectedInstance(null);
    setInitialDate(date);
    setIsDialogOpen(true);
  };

  /**
   * Prepares the state for editing an existing task occurrence.
   * We use a small timeout to ensure the modal's internal state resets correctly
   * if switching between tasks quickly.
   */
  const handleEditTask = (instance: TaskInstance) => {
    setSelectedInstance(instance);
    setIsDialogOpen(false);
    setTimeout(() => setIsDialogOpen(true), 10);
  };

  // --- Task Saving Logic (Plan A: Generation) ---
  const handleSaveTask = async (taskData: any, option: 'instance' | 'series' = 'series') => {
    if (!userProfile?.currentGroupId) {
      console.error("Group missing");
      return;
    }

    try {
      const groupId = userProfile.currentGroupId;
      
      // If saving as an instance (only this instance)
      if (option === 'instance' && selectedInstance) {
        const updatedInstance: Partial<TaskInstance> = {
          id: selectedInstance.id,
          taskId: selectedInstance.taskId,
          dueDate: parseISO(taskData.dueDate).toISOString(),
          assignedTo: taskData.assignedTo === 'unassigned' ? null : taskData.assignedTo,
          status: taskData.status || selectedInstance.status,
          priority: taskData.priority,
          title: taskData.title,
          description: taskData.description,
        };
        await choreService.saveInstance(updatedInstance);
        return;
      }

      // Default logic: Save/Update the Series (the 'task' template)
      const task: Partial<Task> = {
        id: selectedInstance ? selectedInstance.taskId : undefined,
        groupId,
        title: taskData.title,
        description: taskData.description || '',
        isRecurring: taskData.recurrence !== 'none',
        rrule: taskData.recurrence !== 'none' ? JSON.stringify({
          freq: taskData.recurrence,
          interval: taskData.interval || 1,
          byday: taskData.weekDays || []
        }) : undefined,
        startDate: taskData.dueDate, // Use due date as start date if new
        endDate: taskData.recurrenceEndDate || undefined,
        priority: taskData.priority,
        createdBy: userProfile.id,
      };

      const savedTask = await choreService.saveTask(task);
      const taskId = savedTask.id;

      const createInstances = async (startFrom: Date, assignedTo: number | undefined) => {
        const instancesToCreate: Partial<TaskInstance>[] = [];
        let currentDate = startFrom;
        
        const defaultEndDate = addDays(currentDate, 730);
        const endDate = taskData.recurrenceEndDate ? parseISO(taskData.recurrenceEndDate) : defaultEndDate;

          const createInstance = (date: Date): Partial<TaskInstance> => ({
            taskId,
            groupId,
            dueDate: date.toISOString(),
            assignedTo: !assignedTo ? null : assignedTo,
            status: 'TO DO',
            priority: taskData.priority,
          });

        if (taskData.recurrence === 'none') {
          instancesToCreate.push(createInstance(currentDate));
        } else {
          let iterationCount = 0;
          const maxIterations = 730; // 2 years limit
          const startDateObj = startOfDay(parseISO(taskData.dueDate));
          const endDate = taskData.recurrenceEndDate ? startOfDay(parseISO(taskData.recurrenceEndDate)) : addDays(startDateObj, 730);
          
          while (iterationCount < maxIterations) {
            // Termination check: stop if we passed the end date
            if (isBefore(endDate, currentDate) && !isSameDay(currentDate, endDate)) {
              break;
            }

            if (taskData.recurrence === 'daily') {
              instancesToCreate.push(createInstance(currentDate));
              currentDate = addDays(currentDate, 1);
            } else if (taskData.recurrence === 'weekly') {
              instancesToCreate.push(createInstance(currentDate));
              currentDate = addWeeks(currentDate, 1);
            } else if (taskData.recurrence === 'monthly') {
              instancesToCreate.push(createInstance(currentDate));
              currentDate = addMonths(currentDate, 1);
            } else if (taskData.recurrence === 'custom') {
              const matchesDay = taskData.weekDays.length === 0 || taskData.weekDays.includes(getDay(currentDate));
              // Use Monday (1) as week start for consistent interval calculation
              const weekDiff = Math.abs(differenceInCalendarWeeks(currentDate, startDateObj, { weekStartsOn: 1 }));
              const matchesInterval = weekDiff % (taskData.interval || 1) === 0;
              
              if (matchesDay && matchesInterval) {
                instancesToCreate.push(createInstance(currentDate));
              }
              currentDate = addDays(currentDate, 1);
            } else {
              break; 
            }
            
            iterationCount++;
            if (instancesToCreate.length >= 365) break; 
          }
        }
        await Promise.all(instancesToCreate.map(inst => choreService.saveInstance(inst)));
      };

      if (selectedInstance) {
          // If updating 'series', we update the instance we are currently looking at as well.
          // In a more complex system, we might update ALL future instances here.
          const updatedInstance: Partial<TaskInstance> = {
            id: selectedInstance.id,
            taskId: selectedInstance.taskId,
            dueDate: parseISO(taskData.dueDate).toISOString(),
            assignedTo: taskData.assignedTo === 'unassigned' ? null : taskData.assignedTo,
            status: taskData.status || selectedInstance.status,
            priority: taskData.priority,
            // When updating the series, we clear overrides on THIS instance so it inherits from the new series defaults
            title: undefined,
            description: undefined,
          };
          await choreService.saveInstance(updatedInstance);
      } else {
        await createInstances(parseISO(taskData.dueDate), taskData.assignedTo);
      }
    } catch (error) {
      console.error("Error in handleSaveTask:", error);
      throw error;
    }
  };

  // --- Task Deletion Handler ---
  const handleDeleteTask = async (id: number, deleteAll?: boolean) => {
    try {
      if (deleteAll) {
        const instance = instances.find(i => i.id === id);
        if (instance) {
          await choreService.deleteInstancesByTaskId(instance.taskId);
          await choreService.deleteTask(instance.taskId);
        }
      } else {
        await choreService.deleteInstance(id);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // --- Loading State View ---
  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // --- Authentication Required View ---
  if (!currentUser) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 mx-auto mb-8">
            <Sparkles className="text-white h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to ChoreFlow</h1>
          <p className="text-slate-500 mb-10">Organize your family chores with ease. Sign in to get started.</p>
          <Button 
            onClick={handleSignIn} 
            className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl gap-3"
          >
            <LogIn className="h-5 w-5" />
            Sign in with Google
          </Button>

          <div className="mt-8 pt-6 border-t border-slate-100 text-left">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Having trouble?</h3>
            <p className="text-xs text-slate-500 leading-relaxed space-y-1">
              If you receive a <strong>403 error</strong> after signing in, ensure:
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>You are not using a private browsing (Incognito) window.</li>
                <li>Your browser allows third-party cookies.</li>
                <li>
                  The following redirect URIs are added to your <strong>Supabase Dashboard</strong> and <strong>Google Cloud Console</strong>:
                  <code className="block mt-1 p-2 bg-slate-50 rounded border border-slate-100 break-all">
                    {window.location.origin}/auth/callback
                  </code>
                </li>
              </ul>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Joining Group Transition View ---
  // Show joining screen if we have a pending invite AND user is logged in
  if (isJoining || (pendingInvite && currentUser)) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-slate-600 font-medium animate-pulse">Joining group...</p>
      </div>
    );
  }

  // --- Profile Loading View ---
  if (!userProfile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // --- Group Onboarding View ---
  if (!userProfile.currentGroupId) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="text-indigo-600 h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Your Setup</h2>
          <p className="text-slate-500 mb-8">Set your name and create your first group to get started.</p>
          
          <div className="space-y-6">
            <div className="text-left space-y-2">
              <label className="text-sm font-semibold text-slate-700 px-1">Your Display Name</label>
              <Input 
                placeholder="How should your family call you?" 
                value={userDisplayName}
                onChange={(e) => setUserDisplayName(e.target.value)}
                className="h-12 rounded-xl border-slate-200 focus:ring-indigo-500"
              />
            </div>

            <div className="text-left space-y-2">
              <label className="text-sm font-semibold text-slate-700 px-1">Group Name</label>
              <Input 
                placeholder="e.g. The Smith Family" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="h-12 rounded-xl border-slate-200 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleCreateGroup} 
                disabled={!newGroupName.trim() || !userDisplayName.trim()}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl font-semibold transition-all active:scale-[0.98]"
              >
                Finish Setup
              </Button>
              
              {userGroups.length > 0 && (
                <Button 
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingNewGroup(false);
                    // This will trigger the auto-select logic to pick the first group
                  }}
                  className="w-full h-10 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Main Application Layout ---
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 256 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white border-r border-slate-200 flex flex-col pt-6 pb-0 shadow-sm z-10 overflow-hidden"
      >
        {/* Logo Section */}
        <div className={cn(
          "flex items-center gap-3 mb-8 px-6",
          !isSidebarOpen && "justify-center px-0"
        )}>
          <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="text-indigo-600 h-5 w-5" />
          </div>
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.h1 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xl font-bold tracking-tight whitespace-nowrap"
              >
                ChoreFlow
              </motion.h1>
            )}
          </AnimatePresence>
        </div>

        {/* Primary Actions */}
        <div className={cn("flex-1 px-6", !isSidebarOpen && "px-0 flex flex-col items-center")}>
          <Button 
            onClick={() => handleAddTask(new Date())}
            className={cn(
              "h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl font-semibold gap-3 transition-all active:scale-[0.98] mb-4 overflow-hidden",
              isSidebarOpen ? "w-full px-4 justify-start" : "w-12 px-0 justify-center"
            )}
          >
            <Plus className="h-5 w-5 shrink-0" />
            {isSidebarOpen && <span className="whitespace-nowrap">New Task</span>}
          </Button>
        </div>

        {/* User & Group Context */}
        <div className={cn("mt-auto pt-5 px-6", !isSidebarOpen && "px-0 flex flex-col items-center")}>
          <div className="space-y-2 mb-2 w-full">
            {userProfile && (() => {
              const displayInfo = { name: userProfile.name, color: userProfile.color };
              return (
                <div 
                  key={userProfile.id} 
                  className={cn(
                    "flex items-center gap-3 h-12 group cursor-pointer rounded-xl transition-colors hover:bg-slate-50",
                    isSidebarOpen ? "px-3" : "justify-center"
                  )}
                  onClick={() => {
                    setUserToEdit(userProfile);
                    setIsSettingsOpen(true);
                  }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm transition-transform group-hover:scale-110 shrink-0" 
                    style={{ backgroundColor: displayInfo.color }}
                  >
                    {displayInfo.name[0]}
                  </div>
                  {isSidebarOpen && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 truncate">{displayInfo.name}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          
          {/* Group Selector */}
          <div className="mb-2 w-full flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button 
                  variant="ghost" 
                  className={cn(
                    "h-12 rounded-xl transition-all flex items-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 group border border-transparent hover:border-indigo-100",
                    isSidebarOpen ? "w-full px-3 gap-3" : "w-12 px-0 justify-center"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm group-hover:border-indigo-200 transition-colors">
                    <Home className="h-5 w-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  {isSidebarOpen && (
                    <>
                      <span className="text-sm font-medium truncate">{currentGroup?.name || 'Loading...'}</span>
                      <ChevronDown className="h-5 w-5 ml-auto text-slate-400 group-hover:text-indigo-400 transition-colors" />
                    </>
                  )}
                </Button>
              } />
              <DropdownMenuContent className="w-56 rounded-xl shadow-xl border-slate-100 p-2" align={isSidebarOpen ? "start" : "center"}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">My Groups</DropdownMenuLabel>
                  {userGroups.map((group) => (
                    <DropdownMenuItem 
                      key={group.id}
                      onClick={() => handleSwitchGroup(group.id)}
                      className={cn(
                        "rounded-lg font-medium text-sm py-2.5 px-3 cursor-pointer flex items-center justify-between",
                        group.id === currentGroup?.id ? "bg-indigo-50 text-indigo-600" : "focus:bg-slate-50"
                      )}
                    >
                      <span className="truncate">{group.name}</span>
                      {group.id === currentGroup?.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setIsCreatingNewGroup(true);
                    setUserProfile(prev => prev ? { ...prev, currentGroupId: undefined } : null);
                  }}
                  className="rounded-lg font-medium text-sm py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer text-indigo-600"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  New Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Settings Trigger */}
          <Button 
            variant="ghost" 
            onClick={() => {
              setUserToEdit(null);
              setIsSettingsOpen(true);
            }}
            className={cn(
              "h-12 rounded-xl transition-all flex items-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 group border border-transparent hover:border-indigo-100",
              isSidebarOpen ? "w-full px-3 gap-3 justify-start" : "w-12 px-0 justify-center"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm group-hover:border-indigo-200 transition-colors">
              <Settings className="h-5 w-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            </div>
            {isSidebarOpen && <span className="text-sm font-medium">Settings</span>}
          </Button>

          {/* Collapse Toggle at Bottom */}
          <div className="mt-0 pt-0 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "w-full h-10 flex items-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all",
                isSidebarOpen ? "justify-start px-3 gap-3" : "justify-center px-0"
              )}
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                {isSidebarOpen ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
              </div>
              {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wider">Collapse Sidebar</span>}
            </Button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 min-h-0"
        >
          <Calendar 
            instances={instances} 
            tasks={tasks}
            users={users} 
            currentUserId={userProfile.id}
            groupId={currentGroup?.id}
            onAddTask={handleAddTask} 
            onEditTask={handleEditTask} 
          />
        </motion.div>
      </main>

      {/* Modals & Dialogs */}
      <TaskDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={selectedInstance}
        tasks={tasks}
        users={users}
        initialDate={initialDate}
        currentUserId={userProfile.id}
        groupId={currentGroup?.id}
      />

      {isSettingsOpen && userProfile && (
        <SettingsModal 
          currentUser={userProfile}
          currentGroup={currentGroup}
          initialEditingUser={userToEdit}
          onClose={() => {
            setIsSettingsOpen(false);
            setUserToEdit(null);
          }}
        />
      )}
    </div>
  );
}



