import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  subDays,
  eachDayOfInterval,
  addWeeks,
  subWeeks
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Check, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TaskInstance, Task, User } from '../types';
import { choreService } from '../lib/choreService';
import { getUserDisplayInfo } from '../lib/userUtils';

interface CalendarProps {
  /** Array of all task occurrences within the current household context. */
  instances: TaskInstance[];
  /** Array of all task templates (blueprints) available in the household. */
  tasks: Task[];
  /** List of all household members for color coding and assignment display. */
  users: User[];
  /** The unique ID of the currently authenticated user. */
  currentUserId: string;
  /** The ID of the current household context. */
  householdId?: string;
  /** Triggered when the user clicks 'plus' or a day to create a new task. */
  onAddTask: (date: Date) => void;
  /** Triggered when a task card is clicked for editing. */
  onEditTask: (instance: TaskInstance) => void;
}

/**
 * The primary Calendar component for the application.
 * It renders a monthly or weekly grid view and handles task navigation, 
 * organization (Rhythm Algorithm), and status toggling.
 */
export const Calendar: React.FC<CalendarProps> = ({ 
  instances, 
  tasks, 
  users, 
  currentUserId, 
  householdId,
  onAddTask, 
  onEditTask 
}) => {
  // --- View & Navigation State ---
  /** Current view mode: 'month' for full monthly grid, 'week' for a single 7-day row, and 'day' for a detailed single-day list. */
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  /** The reference date that dictates which context is being displayed. */
  const [referenceDate, setReferenceDate] = useState(new Date());

  /** Navigation Logic: Moves the view forward or backward based on current mode. */
  const next = () => {
    if (view === 'month') setReferenceDate(addMonths(referenceDate, 1));
    else if (view === 'week') setReferenceDate(addWeeks(referenceDate, 1));
    else setReferenceDate(addDays(referenceDate, 1));
  };
  
  const prev = () => {
    if (view === 'month') setReferenceDate(subMonths(referenceDate, 1));
    else if (view === 'week') setReferenceDate(subWeeks(referenceDate, 1));
    else setReferenceDate(subDays(referenceDate, 1));
  };

  /** Reset the view to the current date. */
  const goToToday = () => setReferenceDate(new Date());

  // --- Calendar Grid Calculation ---
  /** 
   * Dynamic Date calculation based on view mode.
   * Month: Shows 5-6 rows spanning the entire month.
   * Week: Shows 1 row spanning the current week of the reference date.
   * Day: Isolates the single reference date.
   */
  const getInterval = () => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 1 });
      return { start, end };
    } else if (view === 'week') {
      const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      return { start, end };
    } else {
      return { start: referenceDate, end: referenceDate };
    }
  };

  const { start, end } = getInterval();
  const calendarDays = eachDayOfInterval({ start, end });

  // --- Helper Functions for Data Mapping ---

  /**
   * Orchestrates the "Rhythm Algorithm":
   * 1. Filters instances to find those occurring on the target date.
   * 2. Sorts them so that active ('to do') tasks are pinned to the top.
   * 3. Pushes completed ('done') tasks to the bottom.
   * 4. Applies secondary/tertiary sorting for total stability (alphabetical + ID).
   */
  const getInstancesForDay = (day: Date) => {
    return instances
      .filter(instance => isSameDay(new Date(instance.dueDate), day))
      .sort((a, b) => {
        // Primary: Status (Active vs. Done)
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        
        // Secondary: Title (Alphabetical)
        const taskA = getTaskForInstance(a.taskId);
        const taskB = getTaskForInstance(b.taskId);
        const titleA = taskA?.title.toLowerCase() || '';
        const titleB = taskB?.title.toLowerCase() || '';
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;

        // Tertiary: ID (Fallback for absolute stability)
        return a.id.localeCompare(b.id);
      });
  };

  const getTaskForInstance = (taskId: string) => tasks.find(t => t.id === taskId);
  const getUserColor = (userId?: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return '#cbd5e1';
    return getUserDisplayInfo(user, householdId).color;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* --- Calendar Header (Navigation & View Switcher) --- */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {format(referenceDate, view === 'month' ? 'MMMM yyyy' : 'MMMM d, yyyy')}
          </h2>
          {view === 'week' && (
            <span className="text-sm font-medium text-slate-500 mt-1">
              Week {format(start, 'dd.MM')} - {format(end, 'dd.MM')}
            </span>
          )}
          {view === 'day' && (
            <span className="text-sm font-medium text-slate-500 mt-1">
              {format(referenceDate, 'EEEE')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* --- View Switcher --- */}
          <div className="flex bg-slate-200/50 p-1 rounded-xl mr-2 shadow-inner">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setView('month')}
              className={cn(
                "h-8 px-4 text-xs font-bold rounded-lg transition-all",
                view === 'month' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              Month
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setView('week')}
              className={cn(
                "h-8 px-4 text-xs font-bold rounded-lg transition-all",
                view === 'week' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              Week
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setView('day')}
              className={cn(
                "h-8 px-4 text-xs font-bold rounded-lg transition-all",
                view === 'day' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              Day
            </Button>
          </div>

          <Button 
            variant="outline" 
            onClick={goToToday}
            className="h-10 px-4 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl shadow-sm transition-all"
          >
            Today
          </Button>
          
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm h-10 items-center">
            <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="w-[1px] h-4 bg-slate-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8 hover:bg-slate-100 rounded-lg">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* --- Weekday Labels (Conditional) --- */}
      {view !== 'day' && (
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
      )}

      {/* --- Dynamic Day Grid or Day View --- */}
      {view === 'day' ? (
        <div key="view-day" className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <h3 className="text-xl font-bold text-slate-800">
                  Tasks for today
                </h3>
              </div>
              <Button 
                onClick={() => onAddTask(referenceDate)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 h-11 shadow-lg shadow-indigo-100 font-bold"
              >
                <Plus className="mr-2 h-5 w-5" />
                New Task
              </Button>
            </div>

            {getInstancesForDay(referenceDate).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
                <div className="text-5xl mb-6 hover:rotate-12 transition-transform cursor-default">
                  😎
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">No tasks scheduled</h4>
                <p className="text-slate-500 max-w-sm px-6">
                  Everything is clear for today. Use the button above to schedule a new chore!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {getInstancesForDay(referenceDate).map((instance) => {
                  const taskDef = getTaskForInstance(instance.taskId);
                  const assignedUser = users.find(u => u.id === instance.assignedTo);
                  const isDone = instance.status === 'done';
                  
                  return (
                    <div key={instance.id}>
                      <button
                        onClick={() => onEditTask(instance)}
                        className={cn(
                          "w-full h-[64px] flex items-center gap-6 px-5 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 text-left group",
                          isDone ? "opacity-75 grayscale-[0.3]" : ""
                        )}
                      >
                        {/* --- Status Ring --- */}
                        <div 
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer",
                            isDone 
                              ? "bg-emerald-50 border-emerald-500 text-emerald-500" 
                              : "border-slate-200 text-slate-300 group-hover:border-indigo-400 group-hover:text-indigo-400"
                          )}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await choreService.toggleInstanceStatus(instance.id, instance.status, currentUserId);
                          }}
                        >
                          {isDone && (
                            <Check className="h-4 w-4" strokeWidth={3} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={cn(
                              "text-lg font-bold leading-tight truncate",
                              isDone ? "text-slate-400 line-through" : "text-slate-800"
                            )}>
                              {taskDef?.title || 'Unknown Task'}
                            </h4>
                            {instance.priority === 'high' && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                <Flame className="h-3 w-3 fill-orange-600" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Burning</span>
                              </div>
                            )}
                          </div>
                          {taskDef?.description && (
                            <p className="text-sm text-slate-500 truncate max-w-md">
                              {taskDef.description}
                            </p>
                          )}
                        </div>

                        {assignedUser && (
                          <div className="flex items-center gap-3 pr-4">
                            <div 
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                              style={{ backgroundColor: assignedUser.color }}
                            >
                              {assignedUser.name.charAt(0)}
                            </div>
                            <div className="hidden sm:flex flex-col">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Assigned To</span>
                              <span className="text-sm font-bold text-slate-700">{assignedUser.name}</span>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div 
          key={`grid-view-${view}`}
          className={cn(
            "grid grid-cols-7 flex-1 min-h-0",
            view === 'week' ? "grid-rows-1" : ""
          )}
          style={view === 'month' ? { gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, 1fr)` } : undefined}
        >
        {calendarDays.map((day) => {
          const dayInstances = getInstancesForDay(day);
          const isRefMonth = isSameMonth(day, referenceDate);
          const isToday = isSameDay(day, new Date());
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={day.toString()}
              className={cn(
                "border-r border-b border-slate-100 p-2 transition-colors group relative flex flex-col min-h-0",
                view === 'month' && !isRefMonth && "bg-slate-50/40 text-slate-300",
                (view === 'week' || isRefMonth) && "hover:bg-indigo-50/30"
              )}
            >
              {/* --- Day Number & Add Action --- */}
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "flex items-center justify-center h-7 w-7 text-sm font-semibold rounded-full transition-all",
                  isToday 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                    : (view === 'week' || isRefMonth) && isWeekend 
                      ? "text-rose-500 group-hover:text-rose-600" 
                      : "text-slate-600 group-hover:text-indigo-600",
                  view === 'month' && !isRefMonth && "text-slate-300"
                )}>
                  {format(day, 'd')}
                </span>
                <button 
                  onClick={() => onAddTask(day)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-100 rounded-md transition-all text-indigo-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* --- Task Instances for the Day --- */}
              {/* This container manages the vertical layout of tasks within a calendar cell. */}
              <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
                {dayInstances.map((instance) => {
                  const task = getTaskForInstance(instance.taskId);
                  const isDone = instance.status === 'done';
                  
                  return (
                    <div
                      key={instance.id}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevents clicking the card from triggering cell-level events.
                        onEditTask(instance);
                      }}
                      /* Dynamic styling based on completion status. 
                         Completed tasks ('done') use a green emerald theme, while active tasks use indigo. */
                      className={cn(
                        "group/task px-2 py-1.5 rounded-md text-[11px] font-medium border cursor-pointer shadow-sm transition-all relative overflow-hidden",
                        isDone 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/80" 
                          : "bg-indigo-50/80 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate pr-5">
                        {/* Render the user's assigned color dot if the task is assigned to someone. */}
                        {instance.assignedTo && instance.assignedTo !== 'unassigned' && (
                          <div 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              isDone && "opacity-50"
                            )} 
                            style={{ backgroundColor: getUserColor(instance.assignedTo) }}
                          />
                        )}
                        {/* Priority Icon */}
                        {instance.priority === 'high' && (
                          <Flame className={cn("h-3 w-3 shrink-0 text-orange-500 fill-orange-500", isDone && "opacity-40")} />
                        )}
                        {/* Title with strikethrough effect for completed tasks. */}
                        <span className={cn(
                          "truncate transition-all duration-300",
                          isDone && "line-through text-emerald-600/60"
                        )}>
                          {task?.title || 'Task'}
                        </span>
                      </div>

                      {/* --- Sliding Done Action --- */}
                      {/* This interactive element slides in from the right on hover (for active tasks)
                          or stays visible if the task is already marked as done. */}
                      <div 
                        className={cn(
                          "absolute top-0 bottom-0 flex items-center justify-center transition-all duration-300 ease-out",
                          isDone 
                            ? "right-1 opacity-100 scale-100" 
                            : "right-[-30px] group-hover/task:right-1 group-hover/task:opacity-100 opacity-0 scale-90"
                        )}
                        onClick={async (e) => {
                          e.stopPropagation(); // Prevents toggling from also opening the edit dialog.
                          await choreService.toggleInstanceStatus(instance.id, instance.status, currentUserId);
                        }}
                      >
                        {/* The checkmark circle button. */}
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center transition-colors shadow-sm",
                          isDone 
                            ? "bg-emerald-500 text-white" 
                            : "bg-white border border-indigo-200 text-indigo-400 hover:text-emerald-500 hover:border-emerald-500"
                        )}>
                          {isDone ? (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
};
