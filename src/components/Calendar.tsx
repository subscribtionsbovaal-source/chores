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
  eachDayOfInterval 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TaskInstance, Task, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface CalendarProps {
  instances: TaskInstance[];
  tasks: Task[];
  users: User[];
  onAddTask: (date: Date) => void;
  onEditTask: (instance: TaskInstance) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ instances, tasks, users, onAddTask, onEditTask }) => {
  // --- Date State & Navigation ---
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // --- Calendar Grid Calculation ---
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  // --- Helper Functions for Data Mapping ---
  const getInstancesForDay = (day: Date) => {
    return instances.filter(instance => isSameDay(new Date(instance.dueDate), day));
  };

  const getTaskForInstance = (taskId: string) => {
    return tasks.find(t => t.id === taskId);
  };

  const getUserColor = (userId?: string) => {
    return users.find(u => u.id === userId)?.color || '#cbd5e1';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* --- Calendar Header (Month Navigation) --- */}
      <div className="flex items-center justify-between px-8 py-6 border-bottom border-slate-100 bg-slate-50/50">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setCurrentMonth(new Date())}
            className="h-10 px-4 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl shadow-sm transition-all"
          >
            Today
          </Button>
          
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm h-10 items-center">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="w-[1px] h-4 bg-slate-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 hover:bg-slate-100 rounded-lg">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* --- Weekday Labels --- */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* --- Monthly Day Grid --- */}
      <div 
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, 1fr)` }}
      >
        {calendarDays.map((day, idx) => {
          const dayInstances = getInstancesForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={day.toString()}
              className={cn(
                "border-r border-b border-slate-100 p-2 transition-colors group relative flex flex-col min-h-0",
                !isCurrentMonth && "bg-slate-50/40 text-slate-300",
                isCurrentMonth && "hover:bg-indigo-50/30"
              )}
            >
              {/* --- Day Number & Add Action --- */}
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "flex items-center justify-center h-7 w-7 text-sm font-semibold rounded-full transition-all",
                  isToday 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                    : isCurrentMonth && isWeekend 
                      ? "text-rose-500 group-hover:text-rose-600" 
                      : "text-slate-600 group-hover:text-indigo-600",
                  !isCurrentMonth && "text-slate-300"
                )}>
                  {format(day, 'd')}
                </span>
                {isCurrentMonth && (
                  <button 
                    onClick={() => onAddTask(day)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-100 rounded-md transition-all text-indigo-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* --- Task Instances for the Day --- */}
              <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
                <AnimatePresence mode="popLayout">
                  {dayInstances.map((instance) => {
                    const task = getTaskForInstance(instance.taskId);
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={instance.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(instance);
                        }}
                        className={cn(
                          "px-2 py-1.5 rounded-md text-[11px] font-medium border cursor-pointer shadow-sm transition-colors hover:bg-indigo-200",
                          "bg-indigo-100 text-indigo-700 border-indigo-200"
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {instance.assignedTo && instance.assignedTo !== 'unassigned' && (
                            <div 
                              className="w-1.5 h-1.5 rounded-full shrink-0" 
                              style={{ backgroundColor: getUserColor(instance.assignedTo) }}
                            />
                          )}
                          <span className="truncate">{task?.title || 'Task'}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
