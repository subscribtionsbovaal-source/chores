import React, { useState, useEffect } from 'react';
import { User, Household, GlobalRole } from '../types';
import { choreService } from '../lib/choreService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, User as UserIcon, Home, ChevronRight, Save, X, Settings, Users, LogOut, TriangleAlert, Check, Link as LinkIcon, Copy, RefreshCw, Mail, Send } from 'lucide-react';
import { signOut } from '../lib/firebase';

const PROFILE_COLORS = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Slate', value: '#64748b' },
];

const getColorName = (hex: string) => {
  return PROFILE_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase())?.name || 'Custom';
};

interface SettingsModalProps {
  currentUser: User;
  currentHousehold: Household | null;
  onClose: () => void;
  initialEditingUser?: User | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ currentUser, currentHousehold, onClose, initialEditingUser }) => {
  const [view, setView] = useState<'menu' | 'edit_user' | 'system_admin'>('menu');
  const [editingUser, setEditingUser] = useState<User | null>(initialEditingUser || null);
  const [householdName, setHouseholdName] = useState('');
  const [householdAdmins, setHouseholdAdmins] = useState<string[]>([]);
  
  const [householdUsers, setHouseholdUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allHouseholds, setAllHouseholds] = useState<Household[]>([]);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    userName: string;
    newRole: string;
    isGlobal: boolean;
  } | null>(null);
  const [showAdminError, setShowAdminError] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const isSystemAdmin = currentUser.role === 'system_admin';
  const isHouseholdAdmin = currentHousehold?.admins.includes(currentUser.id) || isSystemAdmin;

  useEffect(() => {
    if (currentHousehold) {
      setHouseholdName(currentHousehold.name);
      setHouseholdAdmins(currentHousehold.admins);
      const unsub = choreService.subscribeToHouseholdUsers(currentHousehold.id, setHouseholdUsers);
      return () => unsub();
    }
  }, [currentHousehold]);

  useEffect(() => {
    if (isSystemAdmin && view === 'system_admin') {
      const loadAll = async () => {
        const users = await choreService.getAllUsers();
        const households = await choreService.getAllHouseholds();
        if (users) setAllUsers(users);
        if (households) setAllHouseholds(households);
      };
      loadAll();
    }
  }, [isSystemAdmin, view]);

  useEffect(() => {
    setIsColorPickerOpen(false);
    setIsRoleDropdownOpen(false);
  }, [editingUser?.id]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await choreService.updateUser(editingUser.id, editingUser);
    
    // Also update household admins if they were changed in this view
    if (currentHousehold && JSON.stringify(householdAdmins) !== JSON.stringify(currentHousehold.admins)) {
      await handleUpdateHousehold();
    }
    
    setEditingUser(null);
  };

  const handleUpdateHousehold = async () => {
    if (!currentHousehold) return;
    await choreService.updateHousehold(currentHousehold.id, {
      ...currentHousehold,
      name: householdName,
      admins: householdAdmins
    });
  };

  const handleGenerateToken = async () => {
    if (!currentHousehold) return;
    setIsGenerating(true);
    try {
      await choreService.generateInvitationToken(currentHousehold.id);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!currentHousehold?.invitationToken) return;
    const link = `${window.location.origin}?invite=${currentHousehold.invitationToken}`;
    navigator.clipboard.writeText(link);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const handleSendInvite = async () => {
    if (!currentHousehold || !inviteEmail.trim()) return;
    setIsSendingInvite(true);
    setInviteStatus(null);
    try {
      // 1. Create invitation record in Firestore
      await choreService.createInvitation(currentHousehold.id, inviteEmail.trim(), currentUser.id);
      
      // 2. Send email via server API
      const inviteLink = `${window.location.origin}?invite=${currentHousehold.invitationToken}`;
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          householdName: currentHousehold.name,
          inviteLink,
          invitedBy: currentUser.name
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send invite');

      setInviteStatus({ type: 'success', message: `Invite sent to ${inviteEmail}` });
      setInviteEmail('');
      setTimeout(() => setInviteStatus(null), 3000);
    } catch (error) {
      setInviteStatus({ type: 'error', message: (error as Error).message });
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Settings className="text-white h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Settings</h2>
              <p className="text-xs text-slate-500 font-medium">
                {isSystemAdmin ? 'System Administrator' : isHouseholdAdmin ? 'Household Administrator' : 'User Settings'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-500" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]">
          <AnimatePresence mode="wait">
            {view === 'menu' && (
              <motion.div 
                key="menu"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Household Settings & Info */}
                {currentHousehold && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Household Settings</h3>
                      {isHouseholdAdmin && (
                        <Button 
                          size="sm" 
                          onClick={handleUpdateHousehold}
                          disabled={householdName === currentHousehold.name && JSON.stringify(householdAdmins) === JSON.stringify(currentHousehold.admins)}
                          className="h-10 w-[100px] bg-indigo-600 hover:bg-indigo-700 text-xs font-bold gap-1.5 rounded-lg"
                        >
                          <Save className="h-5 w-5" />
                          Save
                        </Button>
                      )}
                    </div>
                    
                    <div className="p-4 rounded-2xl border border-slate-50 bg-slate-50/50 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Household Name</Label>
                        <Input 
                          value={householdName}
                          onChange={(e) => setHouseholdName(e.target.value)}
                          readOnly={!isHouseholdAdmin}
                          className={cn(
                            "h-10 rounded-xl border-slate-200 focus:ring-indigo-500 bg-white",
                            !isHouseholdAdmin && "bg-slate-50 text-slate-500 cursor-not-allowed"
                          )}
                        />
                      </div>

                      {/* Invitation Link */}
                      {isHouseholdAdmin && (
                        <div className="space-y-1.5 pt-2">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Invitation Link</Label>
                          {currentHousehold.invitationToken ? (
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input 
                                  readOnly
                                  value={`${window.location.origin}?invite=${currentHousehold.invitationToken}`}
                                  className="h-10 rounded-xl border-slate-200 bg-slate-50 pr-10 text-xs font-mono text-slate-500"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleCopyLink}
                                  className="absolute right-1 top-1 h-8 w-8 rounded-lg hover:bg-slate-200"
                                >
                                  {showCopySuccess ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-400" />}
                                </Button>
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={handleGenerateToken}
                                disabled={isGenerating}
                                title="Regenerate Link"
                                className="h-10 w-10 rounded-xl border-slate-200 hover:border-indigo-200 hover:bg-indigo-50"
                              >
                                <RefreshCw className={cn("h-4 w-4 text-slate-400", isGenerating && "animate-spin")} />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={handleGenerateToken}
                              disabled={isGenerating}
                              className="w-full h-10 rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 gap-2 font-bold text-xs"
                            >
                              <LinkIcon className="h-4 w-4" />
                              {isGenerating ? 'Generating...' : 'Generate Invitation Link'}
                            </Button>
                          )}
                          <AnimatePresence>
                            {showCopySuccess && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute left-1/2 -translate-x-1/2 bottom-8 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl z-[70]"
                              >
                                Link copied to clipboard!
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Invite by Email Section */}
                      {currentHousehold.invitationToken && (
                        <div className="space-y-1.5 pt-4 border-t border-slate-100">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Invite via Email</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input 
                                type="email"
                                placeholder="family@member.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="h-10 rounded-xl border-slate-200 focus:ring-indigo-500 pl-9 text-xs"
                              />
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            </div>
                            <Button
                              onClick={handleSendInvite}
                              disabled={isSendingInvite || !inviteEmail.trim()}
                              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
                            >
                              {isSendingInvite ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Send
                            </Button>
                          </div>
                          {inviteStatus && (
                            <motion.p 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "text-[10px] font-medium ml-1",
                                inviteStatus.type === 'success' ? "text-emerald-600" : "text-rose-600"
                              )}
                            >
                              {inviteStatus.message}
                            </motion.p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Household Members */}
                {currentHousehold && (
                  <div className="mt-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Household Members</h3>
                    <div className="space-y-3">
                      {householdUsers.map(user => {
                        const isEditing = editingUser?.id === user.id;
                        const canEdit = isHouseholdAdmin || user.id === currentUser.id;
                        const hasChanges = isEditing && (
                          editingUser.name !== user.name || 
                          editingUser.color !== user.color || 
                          (householdAdmins.includes(user.id) !== (currentHousehold?.admins.includes(user.id) ?? false))
                        );
                        
                        return (
                          <div 
                            key={user.id}
                            className={cn(
                              "rounded-2xl border transition-all overflow-hidden",
                              isEditing 
                                ? "border-indigo-200 bg-indigo-50/20 shadow-sm" 
                                : "border-slate-50 bg-slate-50/50 hover:bg-white hover:border-slate-200"
                            )}
                          >
                            <div 
                              className={cn(
                                "flex items-center justify-between p-3 transition-colors group/header",
                                canEdit && "cursor-pointer hover:bg-white/40"
                              )}
                              onClick={() => {
                                if (canEdit) {
                                  setEditingUser(isEditing ? null : user);
                                }
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover/header:scale-105 transition-transform" 
                                  style={{ backgroundColor: user.color }}
                                >
                                  {user.name[0]}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-slate-900 group-hover/header:text-indigo-600 transition-colors">{user.name}</p>
                                    {user.id === currentUser.id && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-600 text-[8px] font-bold uppercase tracking-wider">You</span>
                                    )}
                                    {householdAdmins.includes(user.id) && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-600 text-[8px] font-bold uppercase tracking-wider">Admin</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                                </div>
                              </div>
                              {canEdit && (
                                <Button 
                                  variant={isEditing ? "ghost" : "outline"} 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingUser(isEditing ? null : user);
                                  }}
                                  className={cn(
                                    "h-8 rounded-lg text-xs font-semibold",
                                    isEditing && "text-slate-500 hover:text-slate-700"
                                  )}
                                >
                                  {isEditing ? <X className="h-5 w-5" /> : 'Edit'}
                                </Button>
                              )}
                            </div>

                            <AnimatePresence>
                              {isEditing && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <form onSubmit={handleUpdateUser} className="p-4 pt-0 space-y-4 border-t border-indigo-100/50 mt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                                      <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</Label>
                                        <Input 
                                          value={editingUser.name}
                                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                          className="h-10 rounded-xl border-slate-200 focus:ring-indigo-500 bg-white"
                                        />
                                      </div>

                                      {/* Household Role Selector (Only for Household Admins) */}
                                      {isHouseholdAdmin && currentHousehold && (
                                        <div className="space-y-1.5">
                                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Household Role</Label>
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                                              className="w-full h-10 rounded-xl border border-slate-200 px-3 flex items-center justify-between bg-white hover:border-indigo-300 transition-all"
                                            >
                                              <span className="text-sm font-medium text-slate-700">
                                                {householdAdmins.includes(editingUser.id) ? 'Admin' : 'User'}
                                              </span>
                                              <ChevronRight className={cn("h-5 w-5 text-slate-400 transition-transform", isRoleDropdownOpen && "rotate-90")} />
                                            </button>

                                            <AnimatePresence>
                                              {isRoleDropdownOpen && (
                                                <motion.div
                                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                  className="absolute top-full left-0 right-0 z-20 mt-2 p-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 space-y-1"
                                                >
                                                  {[
                                                    { id: 'user', label: 'User', icon: UserIcon },
                                                    { id: 'admin', label: 'Admin', icon: Shield }
                                                  ].map((role) => {
                                                    const isSelected = (role.id === 'admin' && householdAdmins.includes(editingUser.id)) || 
                                                                     (role.id === 'user' && !householdAdmins.includes(editingUser.id));
                                                    return (
                                                      <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => {
                                                          const newRole = role.id;
                                                          const isAdmin = householdAdmins.includes(editingUser.id);
                                                          
                                                          if (newRole === 'user' && isAdmin) {
                                                            if (householdAdmins.length <= 1) {
                                                              setShowAdminError(true);
                                                              return;
                                                            }
                                                            setPendingRoleChange({
                                                              userId: editingUser.id,
                                                              userName: editingUser.name,
                                                              newRole: 'User',
                                                              isGlobal: false
                                                            });
                                                          } else if (newRole === 'admin' && !isAdmin) {
                                                            setPendingRoleChange({
                                                              userId: editingUser.id,
                                                              userName: editingUser.name,
                                                              newRole: 'Household Admin',
                                                              isGlobal: false
                                                            });
                                                          }
                                                          setIsRoleDropdownOpen(false);
                                                        }}
                                                        className={cn(
                                                          "w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-medium transition-all",
                                                          isSelected 
                                                            ? "bg-indigo-50 text-indigo-600" 
                                                            : "text-slate-600 hover:bg-slate-50"
                                                        )}
                                                      >
                                                        <role.icon className={cn("h-5 w-5", isSelected ? "text-indigo-600" : "text-slate-400")} />
                                                        {role.label}
                                                        {isSelected && <Check className="h-5 w-5 ml-auto" />}
                                                      </button>
                                                    );
                                                  })}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>
                                      )}

                                      <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Profile Color</Label>
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 flex items-center gap-3 bg-white hover:border-indigo-300 transition-all"
                                          >
                                            <div 
                                              className="w-5 h-5 rounded-full shadow-sm" 
                                              style={{ backgroundColor: editingUser.color }}
                                            />
                                            <span className="text-sm font-medium text-slate-700">{getColorName(editingUser.color)}</span>
                                            <ChevronRight className={cn("h-5 w-5 ml-auto text-slate-400 transition-transform", isColorPickerOpen && "rotate-90")} />
                                          </button>

                                          <AnimatePresence>
                                            {isColorPickerOpen && (
                                              <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                className="absolute top-full left-0 right-0 z-10 mt-2 p-3 bg-white rounded-2xl shadow-xl border border-slate-100 grid grid-cols-5 gap-2"
                                              >
                                                {PROFILE_COLORS.map((color) => (
                                                  <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingUser({ ...editingUser, color: color.value });
                                                      setIsColorPickerOpen(false);
                                                    }}
                                                    className={cn(
                                                      "w-full aspect-square rounded-full transition-all flex items-center justify-center relative group",
                                                      editingUser.color === color.value ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "hover:scale-110"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                  >
                                                    {editingUser.color === color.value && <Check className="h-5 w-5 text-white" />}
                                                  </button>
                                                ))}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      </div>
                                    </div>

                                    {isHouseholdAdmin && currentHousehold && (
                                      <p className="text-[9px] text-slate-500 ml-1 -mt-2">
                                        {householdAdmins.includes(editingUser.id) 
                                          ? "Admins can manage household settings and members." 
                                          : "Users can only view household information."}
                                      </p>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                      <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => setEditingUser(null)}
                                        className="flex-1 h-10 rounded-xl font-bold text-xs"
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit" 
                                        disabled={!hasChanges}
                                        className={cn(
                                          "flex-[2] h-10 rounded-xl font-bold text-xs gap-2 transition-all",
                                          hasChanges 
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100" 
                                            : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                        )}
                                      >
                                        <Save className="h-5 w-5" />
                                        Save
                                      </Button>
                                    </div>
                                  </form>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="pt-6 border-t border-slate-100 mt-8 flex items-center gap-3">
                  {isSystemAdmin && (
                    <Button 
                      variant="ghost" 
                      onClick={() => setView('system_admin')}
                      className="flex-1 justify-start gap-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all h-12 rounded-xl px-4"
                    >
                      <Shield className="h-5 w-5" />
                      <span className="font-bold">System Admin</span>
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    onClick={() => signOut()} 
                    className="flex-1 justify-end gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 transition-all h-12 rounded-xl px-4"
                  >
                    <span className="font-bold">Sign Out</span>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {view === 'system_admin' && (
              <motion.div 
                key="system_admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 mb-6">
                  <Button variant="ghost" size="icon" onClick={() => setView('menu')} className="rounded-full">
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </Button>
                  <h3 className="text-xl font-bold text-slate-900">System Administration</h3>
                </div>

                <div className="space-y-6">
                  <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">All Households ({allHouseholds.length})</h4>
                    <div className="space-y-2">
                      {allHouseholds.map(h => (
                        <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{h.name}</p>
                            <p className="text-[10px] text-slate-500">{h.members.length} members • {h.admins.length} admins</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">All Users ({allUsers.length})</h4>
                    <div className="space-y-2">
                      {allUsers.map(u => (
                        <div key={u.id} className="space-y-1">
                          <div 
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group/user"
                            onClick={() => setEditingUser(editingUser?.id === u.id ? null : u)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold group-hover/user:scale-110 transition-transform" style={{ backgroundColor: u.color }}>
                                {u.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 group-hover/user:text-indigo-600 transition-colors">{u.name}</p>
                                <p className="text-[10px] text-slate-500">{u.role} • {u.householdIds.length} households</p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUser(editingUser?.id === u.id ? null : u);
                              }}
                              className="h-8 rounded-lg text-xs"
                            >
                              {editingUser?.id === u.id ? <X className="h-5 w-5" /> : 'Edit'}
                            </Button>
                          </div>
                          
                          <AnimatePresence>
                            {editingUser?.id === u.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-1 pb-2"
                              >
                                {(() => {
                                  const hasChanges = editingUser && (
                                    editingUser.name !== u.name || 
                                    editingUser.role !== u.role || 
                                    editingUser.color !== u.color
                                  );
                                  
                                  return (
                                    <form onSubmit={handleUpdateUser} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                      <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</Label>
                                          <Input 
                                            value={editingUser.name}
                                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                            className="h-9 text-sm bg-white"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</Label>
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                                              className="w-full h-9 rounded-md border border-slate-200 px-2 flex items-center justify-between bg-white hover:border-indigo-300 transition-all"
                                            >
                                              <span className="text-xs font-medium text-slate-700">
                                                {editingUser.role === 'system_admin' ? 'System Admin' : 'User'}
                                              </span>
                                              <ChevronRight className={cn("h-5 w-5 text-slate-400 transition-transform", isRoleDropdownOpen && "rotate-90")} />
                                            </button>

                                            <AnimatePresence>
                                              {isRoleDropdownOpen && (
                                                <motion.div
                                                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                                  className="absolute top-full left-0 right-0 z-30 mt-1 p-1 bg-white rounded-xl shadow-xl border border-slate-100 space-y-0.5"
                                                >
                                                  {[
                                                    { id: 'user', label: 'User', icon: UserIcon },
                                                    { id: 'system_admin', label: 'System Admin', icon: Shield }
                                                  ].map((role) => {
                                                    const isSelected = editingUser.role === role.id;
                                                    return (
                                                      <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => {
                                                          const newRole = role.id;
                                                          if (newRole !== editingUser.role) {
                                                            setPendingRoleChange({
                                                              userId: editingUser.id,
                                                              userName: editingUser.name,
                                                              newRole: newRole === 'system_admin' ? 'System Admin' : 'User',
                                                              isGlobal: true
                                                            });
                                                          }
                                                          setIsRoleDropdownOpen(false);
                                                        }}
                                                        className={cn(
                                                          "w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-medium transition-all",
                                                          isSelected 
                                                            ? "bg-indigo-50 text-indigo-600" 
                                                            : "text-slate-600 hover:bg-slate-50"
                                                        )}
                                                      >
                                                        <role.icon className={cn("h-5 w-5", isSelected ? "text-indigo-600" : "text-slate-400")} />
                                                        {role.label}
                                                        {isSelected && <Check className="h-5 w-5 ml-auto" />}
                                                      </button>
                                                    );
                                                  })}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Color</Label>
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                                              className="w-full h-9 rounded-md border border-slate-200 px-2 flex items-center gap-2 bg-white hover:border-indigo-300 transition-all"
                                            >
                                              <div 
                                                className="w-4 h-4 rounded-full shadow-sm" 
                                                style={{ backgroundColor: editingUser.color }}
                                              />
                                              <span className="text-xs font-medium text-slate-700 truncate">{getColorName(editingUser.color)}</span>
                                              <ChevronRight className={cn("h-5 w-5 ml-auto text-slate-400 transition-transform", isColorPickerOpen && "rotate-90")} />
                                            </button>

                                            <AnimatePresence>
                                              {isColorPickerOpen && (
                                                <motion.div
                                                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                                  className="absolute top-full left-0 right-0 z-20 mt-1 p-2 bg-white rounded-xl shadow-xl border border-slate-100 grid grid-cols-5 gap-1.5"
                                                >
                                                  {PROFILE_COLORS.map((color) => (
                                                    <button
                                                      key={color.value}
                                                      type="button"
                                                      onClick={() => {
                                                        setEditingUser({ ...editingUser, color: color.value });
                                                        setIsColorPickerOpen(false);
                                                      }}
                                                      className={cn(
                                                        "w-full aspect-square rounded-full transition-all flex items-center justify-center relative group",
                                                        editingUser.color === color.value ? "ring-1 ring-offset-1 ring-indigo-500 scale-110" : "hover:scale-110"
                                                      )}
                                                      style={{ backgroundColor: color.value }}
                                                      title={color.name}
                                                    >
                                                      {editingUser.color === color.value && <Check className="h-5 w-5 text-white" />}
                                                    </button>
                                                  ))}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => setEditingUser(null)}
                                          className="flex-1 h-9 rounded-lg text-xs font-semibold text-slate-500"
                                        >
                                          Cancel
                                        </Button>
                                        <Button 
                                          type="submit" 
                                          size="sm" 
                                          disabled={!hasChanges}
                                          className={cn(
                                            "flex-[2] h-9 rounded-lg font-bold text-xs transition-all",
                                            hasChanges 
                                              ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                          )}
                                        >
                                          Save Changes
                                        </Button>
                                      </div>
                                    </form>
                                  );
                                })()}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </section>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {pendingRoleChange && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-slate-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Role Change</h3>
              <p className="text-sm text-slate-600 mb-6">
                Are you sure you want to change <span className="font-bold text-slate-900">{pendingRoleChange.userName}</span>'s role to <span className="font-bold text-indigo-600">{pendingRoleChange.newRole}</span>?
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setPendingRoleChange(null)}
                  className="flex-1 h-11 rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    if (pendingRoleChange.isGlobal) {
                      setEditingUser({ 
                        ...editingUser!, 
                        role: pendingRoleChange.newRole === 'System Admin' ? 'system_admin' : 'user' 
                      });
                    } else {
                      const isAdmin = householdAdmins.includes(pendingRoleChange.userId);
                      if (isAdmin) {
                        setHouseholdAdmins(householdAdmins.filter(id => id !== pendingRoleChange.userId));
                      } else {
                        setHouseholdAdmins([...householdAdmins, pendingRoleChange.userId]);
                      }
                    }
                    setPendingRoleChange(null);
                  }}
                  className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold"
                >
                  Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Error Dialog */}
      <AnimatePresence>
        {showAdminError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-slate-100"
            >
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                <TriangleAlert className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Action Not Permitted</h3>
              <p className="text-sm text-slate-600 mb-6">
                A household must have at least one administrator. You cannot demote the last remaining admin.
              </p>
              <Button 
                onClick={() => setShowAdminError(false)}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
              >
                Understood
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
