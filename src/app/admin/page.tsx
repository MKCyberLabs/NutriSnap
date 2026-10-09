'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { PageHeader } from '@/components/app-shell/PageHeader';
import { MetricCard } from '@/components/design-system/MetricCard';
import { SectionCard } from '@/components/design-system/SectionCard';
import { StatusPill } from '@/components/design-system/StatusPill';
import { getAuthSession } from '@/lib/auth-mock';
import { fetchAllUsers, createDbUser, updateDbUser, deleteDbUser } from '@/ai/actions/db-admin';
import { User, UserRole } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Activity, 
  ShieldCheck,
  UserPlus, 
  Edit, 
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [managedUsers, setManagedUsers] = useState<(User & { password?: string })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User & { password?: string, telegramId?: string | null }>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.push('/');
      return;
    }
    if (session.role !== 'ADMIN') {
      router.push('/today');
      return;
    }
    setAdminUser(session);
    fetchAllUsers().then(users => setManagedUsers(users as any));
  }, [router]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.email || !currentUser.name) return;

    const res = await createDbUser({
      name: currentUser.name || '',
      email: currentUser.email || '',
      role: currentUser.role || 'USER',
      telegramId: currentUser.telegramId || null,
      password: currentUser.password
    });

    if (res.success && res.user) {
      setManagedUsers([...managedUsers, res.user as any]);
      setIsCreateOpen(false);
      setCurrentUser({});
      toast({ title: "User Created", description: `${res.user.name} has been added to the database.` });
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error || "Could not create user." });
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.id) return;

    const res = await updateDbUser(currentUser.id, currentUser);
    
    if (res.success && res.user) {
      const updated = managedUsers.map(u => u.id === currentUser.id ? res.user as any : u);
      setManagedUsers(updated);
      setIsEditOpen(false);
      setCurrentUser({});
      toast({ title: "User Updated", description: "The profile has been successfully modified in the database." });
    } else {
      toast({ variant: "destructive", title: "Error", description: "Failed to update user." });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === adminUser?.id) {
      toast({ variant: "destructive", title: "Action Denied", description: "You cannot delete your own admin account." });
      setDeleteId(null);
      return;
    }
    
    const res = await deleteDbUser(id);

    if (res.success) {
      const updated = managedUsers.filter(u => u.id !== id);
      setManagedUsers(updated);
      toast({ title: "User Deleted", description: "The account has been removed from the database." });
    } else {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete user." });
    }
    setDeleteId(null);
  };

  // ⚡ Bolt Optimization: Pre-compute lowercase search targets.
  // This avoids O(N) string concatenation and memory allocations per keystroke,
  // reducing garbage collection pressure and improving render speed during search.
  const mappedUsers = useMemo(() => {
    return managedUsers.map(u => ({
      original: u,
      searchString: `${u.name || ''} ${u.email || ''}`.toLowerCase()
    }));
  }, [managedUsers]);

  // ⚡ Bolt Optimization: Fast O(N) lookup against pre-computed strings.
  // The search term is lowercased exactly once per keystroke, rather than N times.
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return managedUsers;
    const term = searchTerm.toLowerCase();
    return mappedUsers
      .filter(u => u.searchString.includes(term))
      .map(u => u.original);
  }, [mappedUsers, searchTerm, managedUsers]);

  return (
    <AppShell>
      <PageHeader
        title="Admin"
        description="Manage NutriSnap users and system access"
        action={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 px-4 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] font-semibold text-sm shadow-xs flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                <span>Provision User</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white p-6 border border-[#E2E8F0]">
              <DialogHeader className="pb-3 border-b border-[#E2E8F0]">
                <DialogTitle className="text-lg font-bold text-[#1E293B]">New Identity</DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Create a new user profile. Onboarding is enabled by default.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-[#475569]">Full Name</Label>
                  <Input id="name" placeholder="John Doe" value={currentUser.name || ''} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="h-10 rounded-xl border-[#E2E8F0] text-sm" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-[#475569]">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={currentUser.email || ''} onChange={e => setCurrentUser({...currentUser, email: e.target.value})} className="h-10 rounded-xl border-[#E2E8F0] text-sm" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-[#475569]">Initial Password</Label>
                  <Input id="password" type="password" placeholder="Leave blank for default" value={currentUser.password || ''} onChange={e => setCurrentUser({...currentUser, password: e.target.value})} className="h-10 rounded-xl border-[#E2E8F0] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telegram" className="text-xs font-semibold text-[#475569]">Telegram ID (Optional)</Label>
                  <Input id="telegram" placeholder="e.g. 123456789" value={currentUser.telegramId || ''} onChange={e => setCurrentUser({...currentUser, telegramId: e.target.value})} className="h-10 rounded-xl border-[#E2E8F0] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#475569]">System Role</Label>
                  <Select value={currentUser.role || 'USER'} onValueChange={val => setCurrentUser({...currentUser, role: val as UserRole})}>
                    <SelectTrigger aria-label="Select system role" className="h-10 rounded-xl border-[#E2E8F0] text-sm">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-white border border-[#E2E8F0]">
                      <SelectItem value="USER" className="text-sm">Standard User</SelectItem>
                      <SelectItem value="ADMIN" className="text-sm">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" className="w-full h-11 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] font-semibold text-sm shadow-xs">
                    Initialize Account
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Managed Users"
            value={managedUsers.length}
            icon={<Users className="h-4 w-4" />}
            tone="purple"
            helperText="Registered user accounts"
          />
          <MetricCard
            label="Active Profiles"
            value={managedUsers.filter(u => u.onboarded).length}
            icon={<Activity className="h-4 w-4" />}
            tone="green"
            helperText="Onboarded & active"
          />
          <MetricCard
            label="Administrators"
            value={managedUsers.filter(u => u.role === 'ADMIN').length}
            icon={<ShieldCheck className="h-4 w-4" />}
            tone="amber"
            helperText="Privileged access"
          />
          <MetricCard
            label="System Health"
            value="Optimal"
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="green"
            helperText="UAT services operational"
          />
        </div>

        {/* User Directory Card */}
        <SectionCard
          title="User Directory"
          description="View and manage user permissions, Telegram handles, and account access"
          action={
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
              <Input
                aria-label="Search directory"
                placeholder="Search users..."
                className="pl-9 h-9 rounded-xl border-[#E2E8F0] bg-white text-xs focus-visible:ring-[#6D28D9]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          }
        >
          {/* Responsive table with horizontal scrolling container */}
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#E2E8F0]">
                  <TableHead className="font-semibold text-xs text-[#475569]">Identity</TableHead>
                  <TableHead className="font-semibold text-xs text-[#475569]">Role</TableHead>
                  <TableHead className="font-semibold text-xs text-[#475569]">Telegram</TableHead>
                  <TableHead className="font-semibold text-xs text-[#475569]">Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs text-[#475569]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-[#1E293B]">{user.name}</span>
                        <span className="text-xs text-[#64748B]">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={user.role}
                        tone={user.role === 'ADMIN' ? 'purple' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B]">
                      {user.telegramId ? (
                        <span className="text-[#059669] font-medium">{user.telegramId}</span>
                      ) : (
                        'Not linked'
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={user.onboarded ? 'Active' : 'Pending'}
                        tone={user.onboarded ? 'green' : 'amber'}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          aria-label={`Edit ${user.name}`}
                          className="h-8 w-8 rounded-lg text-[#64748B] hover:text-[#6D28D9] hover:bg-[#F5F3FF]"
                          onClick={() => {
                            setCurrentUser(user);
                            setIsEditOpen(true);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          aria-label={`Delete ${user.name}`}
                          className="h-8 w-8 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                          onClick={() => setDeleteId(user.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white p-6 border border-[#E2E8F0]">
          <DialogHeader className="pb-3 border-b border-[#E2E8F0]">
            <DialogTitle className="text-lg font-bold text-[#1E293B]">Modify User</DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Update user details and access privileges.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs font-semibold text-[#475569]">Display Name</Label>
              <Input id="edit-name" value={currentUser.name || ''} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="h-10 rounded-xl border-[#E2E8F0] text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-semibold text-[#475569]">Email Address</Label>
              <Input id="edit-email" type="email" value={currentUser.email || ''} onChange={e => setCurrentUser({...currentUser, email: e.target.value})} className="h-10 rounded-xl border-[#E2E8F0] text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-password" className="text-xs font-semibold text-[#475569]">Update Password</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="New password (optional)"
                value={currentUser.password || ''}
                onChange={e => setCurrentUser({...currentUser, password: e.target.value})}
                className="h-10 rounded-xl border-[#E2E8F0] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-telegram" className="text-xs font-semibold text-[#475569]">Telegram ID</Label>
              <Input
                id="edit-telegram"
                placeholder="e.g. 123456789 (optional)"
                value={currentUser.telegramId || ''}
                onChange={e => setCurrentUser({...currentUser, telegramId: e.target.value})}
                className="h-10 rounded-xl border-[#E2E8F0] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#475569]">System Role</Label>
              <Select value={currentUser.role || 'USER'} onValueChange={val => setCurrentUser({...currentUser, role: val as UserRole})}>
                <SelectTrigger aria-label="Select system role" className="h-10 rounded-xl border-[#E2E8F0] text-sm">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white border border-[#E2E8F0]">
                  <SelectItem value="USER" className="text-sm">Standard User</SelectItem>
                  <SelectItem value="ADMIN" className="text-sm">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full h-11 rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] font-semibold text-sm shadow-xs">
                Commit Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl bg-white p-6 border border-[#E2E8F0]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-[#1E293B]">Delete User Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#64748B]">
              This action cannot be undone. This will permanently delete the user account and remove their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="rounded-xl border-[#E2E8F0] text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDeleteUser(deleteId)} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-sm font-semibold">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
