
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession, getManagedUsers, saveManagedUsers } from '@/lib/auth-mock';
import { User, UserRole } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Activity, 
  ShieldAlert, 
  BarChart3, 
  UserPlus, 
  Edit, 
  Trash2,
  Settings2,
  Search,
  Lock
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
  const [currentUser, setCurrentUser] = useState<Partial<User & { password?: string }>>({});

  useEffect(() => {
    const session = getAuthSession();
    if (!session || session.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    setAdminUser(session);
    setManagedUsers(getManagedUsers());
  }, [router]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.email || !currentUser.name) return;

    const newUser: User & { password?: string } = {
      id: Math.random().toString(36).substr(2, 9),
      name: currentUser.name || '',
      email: currentUser.email || '',
      role: (currentUser.role as UserRole) || 'USER',
      onboarded: true, // Defaulting to true as requested
      password: currentUser.password || 'ProductionPassword123!'
    };

    const updated = [...managedUsers, newUser];
    setManagedUsers(updated);
    saveManagedUsers(updated);
    setIsCreateOpen(false);
    setCurrentUser({});
    toast({ title: "User Created", description: `${newUser.name} has been added with auto-onboarding enabled.` });
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.id) return;

    const updated = managedUsers.map(u => u.id === currentUser.id ? { ...currentUser, onboarded: true } as User & { password?: string } : u);
    setManagedUsers(updated);
    saveManagedUsers(updated);
    setIsEditOpen(false);
    setCurrentUser({});
    toast({ title: "User Updated", description: "The profile has been successfully modified." });
  };

  const handleDeleteUser = (id: string) => {
    if (id === adminUser?.id) {
      toast({ variant: "destructive", title: "Action Denied", description: "You cannot delete your own admin account." });
      return;
    }
    const updated = managedUsers.filter(u => u.id !== id);
    setManagedUsers(updated);
    saveManagedUsers(updated);
    toast({ title: "User Deleted", description: "The account has been removed from the registry." });
  };

  const filteredUsers = managedUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-svh bg-slate-50 dark:bg-slate-950 font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">System Administration</h1>
            <p className="text-muted-foreground mt-1">Global oversight and workforce management for NutriSnap.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl h-12 px-6 gap-2 shadow-lg shadow-primary/20">
                <UserPlus className="h-5 w-5" /> Provision User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none glass-card p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">New Identity</DialogTitle>
                <DialogDescription>Create a new user profile. Onboarding is enabled by default.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" value={currentUser.name || ''} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="rounded-xl" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={currentUser.email || ''} onChange={e => setCurrentUser({...currentUser, email: e.target.value})} className="rounded-xl" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Initial Password</Label>
                  <Input id="password" type="password" placeholder="ProductionPassword123!" value={currentUser.password || ''} onChange={e => setCurrentUser({...currentUser, password: e.target.value})} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>System Role</Label>
                  <Select value={currentUser.role || 'USER'} onValueChange={val => setCurrentUser({...currentUser, role: val as UserRole})}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="USER">Standard User</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full h-11 rounded-xl">Initialize Account</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Managed', val: managedUsers.length, icon: Users, color: 'text-primary' },
            { label: 'Daily Active', val: Math.ceil(managedUsers.length * 0.4), icon: Activity, color: 'text-emerald-500' },
            { label: 'GenAI Tokens', val: '14.2k', icon: BarChart3, color: 'text-amber-500' },
            { label: 'Alerts', val: '0', icon: ShieldAlert, color: 'text-slate-300' }
          ].map((stat, i) => (
            <Card key={i} className="glass-card border-none rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="font-bold uppercase tracking-widest text-[10px]">{stat.label}</CardDescription>
                <CardTitle className="text-3xl font-bold flex items-center justify-between">
                  {stat.val} <stat.icon className={`h-6 w-6 ${stat.color} opacity-80`} />
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="glass-card border-none rounded-[2.5rem] shadow-sm overflow-hidden">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" /> Identity Management</CardTitle>
              <CardDescription>Modify user privileges and account settings.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search directory..." 
                className="pl-10 rounded-2xl bg-white/20 border-white/40 focus:bg-white" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-primary/5 hover:bg-transparent">
                  <TableHead className="font-bold">Identity</TableHead>
                  <TableHead className="font-bold">Role</TableHead>
                  <TableHead className="font-bold">Onboarding</TableHead>
                  <TableHead className="font-bold">Bio Stats</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="border-b border-primary/5 group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="rounded-lg px-2 text-[10px] font-bold">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.onboarded ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"} variant="outline">
                        {user.onboarded ? "Complete" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs italic">
                      {user.metrics ? `${user.metrics.height}cm / ${user.metrics.weight}kg` : "Not provided"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                          onClick={() => {
                            setCurrentUser(user);
                            setIsEditOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none glass-card p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Modify Profile</DialogTitle>
              <DialogDescription>Update the system configuration for this account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Display Name</Label>
                <Input id="edit-name" value={currentUser.name || ''} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email Address</Label>
                <Input id="edit-email" type="email" value={currentUser.email || ''} onChange={e => setCurrentUser({...currentUser, email: e.target.value})} className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Update Password</Label>
                <Input 
                  id="edit-password" 
                  type="password" 
                  placeholder="New password (optional)" 
                  value={currentUser.password || ''} 
                  onChange={e => setCurrentUser({...currentUser, password: e.target.value})} 
                  className="rounded-xl" 
                />
              </div>
              <div className="space-y-2">
                <Label>Identity Role</Label>
                <Select value={currentUser.role || 'USER'} onValueChange={val => setCurrentUser({...currentUser, role: val as UserRole})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="USER">Standard User</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full h-11 rounded-xl">Commit Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
