import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Task, User, TaskInstance, TaskRecurrence } from '../types';
import { format, addDays, addWeeks, addMonths as addMonthsDate } from 'date-fns';

// --- Form Validation Schema ---
const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(50, 'Title too long'),
  description: z.string().max(200, 'Description too long').optional(),
  dueDate: z.string().min(1, 'Date is required'),
  assignedTo: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'custom']),
  interval: z.number().min(1).optional(),
  weekDays: z.array(z.number()).optional(),
  recurrenceEndDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TaskFormValues) => void;
  onDelete?: (id: string, deleteAll?: boolean) => void;
  task?: TaskInstance | null;
  tasks?: Task[];
  users: User[];
  initialDate?: Date;
}

export const TaskDialog: React.FC<TaskDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  task, 
  tasks = [],
  users,
  initialDate 
}) => {
  // --- Form Initialization ---
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      assignedTo: 'unassigned',
      recurrence: 'none',
      interval: 1,
      weekDays: [],
      recurrenceEndDate: '',
    }
  });

  // --- Effect: Populate Form on Edit or New ---
  useEffect(() => {
    if (task) {
      const taskDef = tasks.find(t => t.id === task.taskId);
      reset({
        title: taskDef?.title || '',
        description: taskDef?.description || '',
        dueDate: format(new Date(task.dueDate), 'yyyy-MM-dd'),
        assignedTo: task.assignedTo || 'unassigned',
        recurrence: taskDef?.recurrence || 'none',
        interval: taskDef?.interval || 1,
        weekDays: taskDef?.weekDays || [],
        recurrenceEndDate: taskDef?.recurrenceEndDate ? format(new Date(taskDef.recurrenceEndDate), 'yyyy-MM-dd') : '',
      });
    } else if (initialDate) {
      reset({
        title: '',
        description: '',
        dueDate: format(initialDate, 'yyyy-MM-dd'),
        assignedTo: 'unassigned',
        recurrence: 'none',
        interval: 1,
        weekDays: [],
        recurrenceEndDate: '',
      });
    } else {
      reset();
    }
  }, [task, tasks, initialDate, reset, isOpen]);

  const recurrence = watch('recurrence');
  const selectedWeekDays = watch('weekDays') || [];

  // --- Handler: Custom Recurrence Weekday Toggle ---
  const toggleWeekDay = (day: number) => {
    const current = selectedWeekDays;
    if (current.includes(day)) {
      setValue('weekDays', current.filter(d => d !== day));
    } else {
      setValue('weekDays', [...current, day].sort());
    }
  };

  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // --- Handler: Form Submission ---
  const onSubmit = async (data: TaskFormValues) => {
    setSaveError(null);
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Failed to save task:", error);
      setSaveError("Failed to save task. Please check your connection and try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-5 max-h-[96vh] overflow-y-auto">
        {/* --- Dialog Header --- */}
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {task ? 'Edit Task' : 'Create New Task'}
          </DialogTitle>
        </DialogHeader>
        
        {/* --- Task Form --- */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-1">
          {saveError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium animate-in fade-in zoom-in-95">
              {saveError}
            </div>
          )}
          {/* --- Title & Description --- */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs font-semibold text-slate-700">Task Title</Label>
            <Input 
              id="title" 
              placeholder="e.g., Wash the dishes" 
              {...register('title')}
              className={cn("h-10", errors.title ? 'border-red-500 focus-visible:ring-red-500' : '')}
            />
            {errors.title && <p className="text-[10px] text-red-500 font-medium">{errors.title.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className="text-xs font-semibold text-slate-700">Description (Optional)</Label>
            <Input id="description" placeholder="Any specific details?" {...register('description')} className="h-10" />
          </div>

          {/* --- Date & Assignee --- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dueDate" className="text-xs font-semibold text-slate-700">
                {recurrence === 'none' ? 'Due Date' : 'Start Date'}
              </Label>
              <Input type="date" id="dueDate" {...register('dueDate')} className="h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Assignee</Label>
              <Select 
                onValueChange={(val) => setValue('assignedTo', val)} 
                value={watch('assignedTo')}
              >
                <SelectTrigger className="h-10 w-full flex items-center">
                  <SelectValue placeholder="Unassigned">
                    {(() => {
                      const val = watch('assignedTo');
                      if (val === 'unassigned' || !val) return "Unassigned";
                      const user = users.find(u => u.id === val);
                      if (!user) return "Unassigned";
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                          <span>{user.name}</span>
                        </div>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                        {user.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* --- Recurrence Settings --- */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Recurrence</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['none', 'daily', 'weekly', 'monthly', 'custom'] as const).map((pattern) => (
                  <Button
                    key={pattern}
                    type="button"
                    variant={recurrence === pattern ? 'default' : 'outline'}
                    onClick={() => setValue('recurrence', pattern)}
                    className={cn(
                      "h-9 capitalize text-[10px] font-medium rounded-xl transition-all px-1",
                      recurrence === pattern 
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-md shadow-indigo-100" 
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-200"
                    )}
                  >
                    {pattern}
                  </Button>
                ))}
              </div>
            </div>

            {/* --- Custom Recurrence Options --- */}
            {recurrence === 'custom' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Repeat on</Label>
                  <div className="flex justify-between gap-1">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day, index) => {
                      const dayValue = (index + 1) % 7;
                      return (
                        <Button
                          key={day}
                          type="button"
                          variant={selectedWeekDays.includes(dayValue) ? 'default' : 'outline'}
                          onClick={() => toggleWeekDay(dayValue)}
                          className={cn(
                            "w-9 h-9 p-0 rounded-full text-[10px] font-bold transition-all",
                            selectedWeekDays.includes(dayValue)
                              ? "bg-indigo-600 text-white border-transparent shadow-md"
                              : "border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50"
                          )}
                        >
                          {day}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Label className="text-xs font-semibold text-slate-700">Repeat frequency</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-600">Every</span>
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm h-8">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        className="h-full w-8 rounded-none hover:bg-slate-50 text-slate-500"
                        onClick={() => setValue('interval', Math.max(1, (watch('interval') || 1) - 1))}
                      >
                        -
                      </Button>
                      <input 
                        type="number" 
                        {...register('interval', { valueAsNumber: true })}
                        className="w-10 h-full text-center text-xs font-normal border-none focus:ring-0 bg-transparent p-0"
                        min="1"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        className="h-full w-8 rounded-none hover:bg-slate-50 text-slate-500"
                        onClick={() => setValue('interval', (watch('interval') || 1) + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <span className="text-xs text-slate-600 font-medium">
                      {(watch('interval') || 1) === 1 ? 'week' : 'weeks'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* --- Recurrence End Date --- */}
            {recurrence !== 'none' && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label htmlFor="recurrenceEndDate" className="text-xs font-semibold text-slate-700">
                  Recurrence End Date <span className="text-[10px] font-normal text-slate-400 ml-1">(Optional)</span>
                </Label>
                <Input 
                  type="date" 
                  id="recurrenceEndDate" 
                  {...register('recurrenceEndDate')}
                  className={cn("h-10", errors.recurrenceEndDate ? 'border-red-500 focus-visible:ring-red-500' : '')}
                />
                {errors.recurrenceEndDate && <p className="text-[10px] text-red-500 font-medium">{errors.recurrenceEndDate.message}</p>}
              </div>
            )}
          </div>

          {/* --- Dialog Footer (Actions) --- */}
          <DialogFooter className="flex gap-2 pt-2">
            {task && onDelete && (
              <>
                {/* --- Delete Action --- */}
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => {
                    const taskDef = tasks.find(t => t.id === task.taskId);
                    if (taskDef && taskDef.recurrence !== 'none') {
                      setShowDeleteConfirm(true);
                    } else {
                      onDelete(task.id);
                      onClose();
                    }
                  }}
                  className="mr-auto h-9"
                >
                  Delete
                </Button>

                {/* --- Recurring Delete Confirmation --- */}
                <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Recurring Task</AlertDialogTitle>
                      <AlertDialogDescription>
                        This is a recurring task. Do you want to delete only this instance or the entire task series?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel variant="outline" size="default" className="rounded-xl h-9">Cancel</AlertDialogCancel>
                      <Button
                        variant="outline"
                        onClick={() => {
                          onDelete(task.id, false);
                          setShowDeleteConfirm(false);
                          onClose();
                        }}
                        className="rounded-xl border-slate-200 h-9"
                      >
                        Only this instance
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          onDelete(task.id, true);
                          setShowDeleteConfirm(false);
                          onClose();
                        }}
                        className="rounded-xl h-9"
                      >
                        Entire series
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="h-9">
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 h-9" disabled={isSubmitting}>
              {task ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
