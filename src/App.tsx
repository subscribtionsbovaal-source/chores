/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { TaskDialog } from './components/TaskDialog';
import { SettingsModal } from './components/SettingsModal';
import { choreService } from './lib/choreService';
import { db, auth, signIn, signOut } from './lib/firebase';
import { collection, doc } from 'firebase/firestore';
import { Task, User, TaskInstance, Household } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Users, Settings, Bell, LogOut, LogIn, Plus, ChevronDown, Home, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { addDays, addWeeks, addMonths, isBefore, parseISO, format, startOfWeek, differenceInWeeks } from 'date-fns';
import { getUserDisplayInfo } from './lib/userUtils';

/**
 * The root Application component.
 * It manages the primary application lifecycle, including:
 * 1. Firebase Authentication & User Profile synchronization.
 * 2. Household selection and real-time data subscription.
 * 3. Dynamic generation of task instances based on recurrence templates.
 * 4. Modal state management for task creation and household settings.
 */
export default function App() {
  // --- State Management: Domain Data ---
  /** All available task blueprints (templates) for the selected household. */
  const [tasks, setTasks] = useState<Task[]>([]);
  /** All specific calendar occurrences (instances) for the household. */
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  /** List of all users (family members) belonging to the current household. */
  const [users, setUsers] = useState<User[]>([]);
  
  // --- State Management: Auth & Context ---
  /** The core Firebase Auth user credentials. */
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  /** The detailed Firestore user profile data. See {@link User}. */
  const [userProfile, setUserProfile] = useState<User | null>(null);
  /** The household currently in focus for the user. */
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  /** List of all households the user belongs to. */
  const [userHouseholds, setUserHouseholds] = useState<Household[]>([]);
  /** Tracks if initial authentication state has been resolved. */
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // --- State Management: UI/Navigation ---
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<TaskInstance | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);
  const [isJoining, setIsJoining] = useState(false);
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
  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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
      // 1. Ensure profile exists and is synced (e.g. System Admin role enforcement)
      await choreService.syncUserProfile(currentUser);
      
      if (!active) return;

      // 2. Subscribe to real-time profile updates
      // This allows the homescreen to instantly reflect changes made in SettingsModal
      unsub = choreService.subscribeToUserProfile(currentUser.uid, (profile) => {
        if (active) setUserProfile(profile);
      });
    };
    
    setup();

    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [currentUser]);

  // --- Household Invitation Process ---
  // Handle Invitation Link
  useEffect(() => {
    if (currentUser && userProfile && pendingInvite && !isJoining) {
      const joinHousehold = async () => {
        console.log("[App] Starting joinHousehold process...");
        setIsJoining(true);
        try {
          const household = await choreService.joinHouseholdByToken(pendingInvite, currentUser.uid, currentUser.email || undefined);
          if (household) {
            console.log("[App] Successfully joined household, refreshing profile...");
            // Refresh profile to get updated household list and current household
            const updatedProfile = await choreService.getUser(currentUser.uid);
            if (updatedProfile) {
              console.log("[App] Profile refreshed with household:", updatedProfile.currentHouseholdId);
              setUserProfile(updatedProfile);
            }
          } else {
            console.warn("[App] Token not found or invalid.");
          }
        } catch (error) {
          console.error("[App] Failed to join household:", error);
        } finally {
          console.log("[App] Finishing join process. Clearing invite.");
          sessionStorage.removeItem('pendingInvite');
          setPendingInvite(null);
          setIsJoining(false);
        }
      };
      joinHousehold();
    }
  }, [currentUser, userProfile?.id, pendingInvite]);

  // --- Real-time Data Listeners ---
  // 1. Listen to all households user belongs to (independently of selection)
  useEffect(() => {
    if (!currentUser) {
      setUserHouseholds([]);
      return;
    }

    const unsub = choreService.subscribeToUserHouseholds(currentUser.uid, setUserHouseholds);
    return () => unsub();
  }, [currentUser]);

  // 2. Listen to specific current household data
  useEffect(() => {
    // If we have households but none is selected, auto-select the first one
    if (userHouseholds.length > 0 && !userProfile?.currentHouseholdId && currentUser) {
      choreService.updateUser(currentUser.uid, { currentHouseholdId: userHouseholds[0].id });
      return;
    }

    if (!currentUser || !userProfile?.currentHouseholdId) {
      setTasks([]);
      setInstances([]);
      setUsers([]);
      setCurrentHousehold(null);
      return;
    }

    const householdId = userProfile.currentHouseholdId;
    
    const unsubHousehold = choreService.subscribeToHousehold(householdId, setCurrentHousehold);
    const unsubTasks = choreService.subscribeToTasks(householdId, setTasks);
    const unsubInstances = choreService.subscribeToInstances(householdId, setInstances);
    const unsubUsers = choreService.subscribeToHouseholdUsers(householdId, setUsers);

    return () => {
      unsubHousehold();
      unsubTasks();
      unsubInstances();
      unsubUsers();
    };
  }, [currentUser, userProfile?.currentHouseholdId]);

  // --- Household Switching Handler ---
  const handleSwitchHousehold = async (householdId: string) => {
    if (!currentUser || !userProfile) return;
    if (userProfile.currentHouseholdId === householdId) return;
    
    try {
      await choreService.updateUser(currentUser.uid, { currentHouseholdId: householdId });
    } catch (error) {
      console.error("Failed to switch household:", error);
    }
  };

  // --- Household Creation Handler ---
  const handleCreateHousehold = async () => {
    if (!currentUser || !newHouseholdName.trim()) return;
    try {
      const household = await choreService.createHousehold(newHouseholdName.trim(), currentUser.uid);
      if (household) {
        const updatedProfile = await choreService.getUser(currentUser.uid);
        setUserProfile(updatedProfile);
      }
    } catch (error) {
      console.error("Failed to create household:", error);
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

  // --- Task Saving Logic (Creation & Recurrence) ---
  const handleSaveTask = async (taskData: any) => {
    if (!currentUser || !userProfile?.currentHouseholdId) {
      console.error("Auth or household missing", { currentUser, userProfile });
      return;
    }

    try {
      const householdId = userProfile.currentHouseholdId;
      const taskId = selectedInstance ? selectedInstance.taskId : doc(collection(db, 'tasks')).id;
      
      const existingTask = tasks.find(t => t.id === taskId);
      
      const task: Task = {
        id: taskId,
        householdId,
        title: taskData.title,
        description: taskData.description || '',
        recurrence: taskData.recurrence,
        interval: taskData.recurrence === 'custom' ? taskData.interval : undefined,
        weekDays: taskData.recurrence === 'custom' ? taskData.weekDays : undefined,
        recurrenceEndDate: taskData.recurrenceEndDate || undefined,
        createdBy: existingTask?.createdBy || currentUser.uid,
        createdAt: existingTask?.createdAt || new Date().toISOString(),
      };

      await choreService.saveTask(task);

      const createInstances = async (startFrom: Date, assignedTo: string | undefined) => {
        const instancesToCreate: TaskInstance[] = [];
        let currentDate = startFrom;
        
        // If recurrence is not 'none' and no end date is provided, default to 2 years (730 days)
        const defaultEndDate = addDays(currentDate, 730);
        const endDate = taskData.recurrenceEndDate ? parseISO(taskData.recurrenceEndDate) : defaultEndDate;

          const createInstance = (date: Date) => ({
            id: doc(collection(db, 'task_instances')).id,
            taskId,
            householdId,
            dueDate: date.toISOString(),
            assignedTo: assignedTo === 'unassigned' || !assignedTo ? null : assignedTo,
            status: 'to do' as const,
            priority: (taskData.priority === 'high' ? 'high' : null) as 'high' | null,
          });

        if (taskData.recurrence === 'none') {
          instancesToCreate.push(createInstance(currentDate));
        } else if (taskData.recurrence === 'custom' && taskData.weekDays && taskData.weekDays.length > 0) {
          let count = 0;
          const maxInstances = 365;
          const weekDays = taskData.weekDays;
          const interval = taskData.interval || 1;
          
          // Use the start of the week of the dueDate as a reference point
          const startOfWeekDate = startOfWeek(startFrom, { weekStartsOn: 1 });

          while (count < maxInstances && (isBefore(currentDate, endDate) || format(currentDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd'))) {
            const currentStartOfWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
            const weeksDiff = Math.abs(differenceInWeeks(currentStartOfWeek, startOfWeekDate));
            
            if (weeksDiff % interval === 0 && weekDays.includes(currentDate.getDay())) {
              instancesToCreate.push(createInstance(currentDate));
              count++;
            }
            currentDate = addDays(currentDate, 1);
          }
        } else {
          let count = 0;
          const maxInstances = 365;

          while (count < maxInstances && (isBefore(currentDate, endDate) || format(currentDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd'))) {
            instancesToCreate.push(createInstance(currentDate));
            
            if (taskData.recurrence === 'daily') currentDate = addDays(currentDate, 1);
            else if (taskData.recurrence === 'weekly') currentDate = addWeeks(currentDate, 1);
            else if (taskData.recurrence === 'monthly') currentDate = addMonths(currentDate, 1);
            
            count++;
          }
        }
        await Promise.all(instancesToCreate.map(inst => choreService.saveInstance(inst)));
      };

      if (selectedInstance) {
        const recurrenceChanged = existingTask?.recurrence !== taskData.recurrence;
        const intervalChanged = existingTask?.interval !== taskData.interval;
        const weekDaysChanged = JSON.stringify(existingTask?.weekDays || []) !== JSON.stringify(taskData.weekDays || []);
        const endDateChanged = existingTask?.recurrenceEndDate !== (taskData.recurrenceEndDate || undefined);

        if (recurrenceChanged || intervalChanged || weekDaysChanged || endDateChanged) {
          // Restructure pattern: delete all and recreate
          await choreService.deleteInstancesByTaskId(taskId);
          await createInstances(parseISO(taskData.dueDate), taskData.assignedTo);
        } else {
          // Just update this instance
          const updatedInstance: TaskInstance = {
            ...selectedInstance,
            dueDate: parseISO(taskData.dueDate).toISOString(),
            assignedTo: taskData.assignedTo === 'unassigned' || !taskData.assignedTo ? null : taskData.assignedTo,
            status: taskData.status || selectedInstance.status,
            priority: (taskData.priority === 'high' ? 'high' : null) as 'high' | null,
          };
          await choreService.saveInstance(updatedInstance);
        }
      } else {
        await createInstances(parseISO(taskData.dueDate), taskData.assignedTo);
      }
    } catch (error) {
      console.error("Error in handleSaveTask:", error);
      throw error;
    }
  };

  // --- Task Deletion Handler ---
  const handleDeleteTask = async (id: string, deleteAll?: boolean) => {
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
            onClick={() => signIn()} 
            className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl gap-3"
          >
            <LogIn className="h-5 w-5" />
            Sign in with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  // --- Joining Household Transition View ---
  // Show joining screen if we have a pending invite AND user is logged in
  if (isJoining || (pendingInvite && currentUser)) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-slate-600 font-medium animate-pulse">Joining household...</p>
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

  // --- Household Onboarding View ---
  if (!userProfile.currentHouseholdId) {
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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Your Household</h2>
          <p className="text-slate-500 mb-8">Start by giving your household a name. You can invite family members later.</p>
          
          <div className="space-y-4">
            <div className="text-left space-y-2">
              <label className="text-sm font-semibold text-slate-700 px-1">Household Name</label>
              <Input 
                placeholder="e.g. The Smith Family" 
                value={newHouseholdName}
                onChange={(e) => setNewHouseholdName(e.target.value)}
                className="h-12 rounded-xl border-slate-200 focus:ring-indigo-500"
              />
            </div>
            <Button 
              onClick={handleCreateHousehold} 
              disabled={!newHouseholdName.trim()}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl font-semibold transition-all active:scale-[0.98]"
            >
              Create New Household
            </Button>
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

        {/* User & Household Context */}
        <div className={cn("mt-auto pt-5 px-6", !isSidebarOpen && "px-0 flex flex-col items-center")}>
          <div className="space-y-2 mb-2 w-full">
            {userProfile && (() => {
              const displayInfo = getUserDisplayInfo(userProfile, currentHousehold?.id);
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
                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 truncate">{displayInfo.name}</span>
                  )}
                </div>
              );
            })()}
          </div>
          
          {/* Household Selector */}
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
                      <span className="text-sm font-medium truncate">{currentHousehold?.name || 'Loading...'}</span>
                      <ChevronDown className="h-5 w-5 ml-auto text-slate-400 group-hover:text-indigo-400 transition-colors" />
                    </>
                  )}
                </Button>
              } />
              <DropdownMenuContent className="w-56 rounded-xl shadow-xl border-slate-100 p-2" align={isSidebarOpen ? "start" : "center"}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">My Households</DropdownMenuLabel>
                  {userHouseholds.map((household) => (
                    <DropdownMenuItem 
                      key={household.id}
                      onClick={() => handleSwitchHousehold(household.id)}
                      className={cn(
                        "rounded-lg font-medium text-sm py-2.5 px-3 cursor-pointer flex items-center justify-between",
                        household.id === currentHousehold?.id ? "bg-indigo-50 text-indigo-600" : "focus:bg-slate-50"
                      )}
                    >
                      <span className="truncate">{household.name}</span>
                      {household.id === currentHousehold?.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setUserProfile(prev => prev ? { ...prev, currentHouseholdId: undefined } : null);
                  }}
                  className="rounded-lg font-medium text-sm py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer text-indigo-600"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  New Household
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
            householdId={currentHousehold?.id}
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
        householdId={currentHousehold?.id}
      />

      {isSettingsOpen && userProfile && (
        <SettingsModal 
          currentUser={userProfile}
          currentHousehold={currentHousehold}
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



