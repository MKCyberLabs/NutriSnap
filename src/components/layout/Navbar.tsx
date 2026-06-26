'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, UserCircle, Settings, KeyRound, MessageCircle } from 'lucide-react';
import { getAuthSession, clearAuthSession, saveAuthSession } from '@/lib/auth-mock';
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateUserSettings } from '@/ai/actions/db-users';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<Partial<User & { telegramId?: string | null }> | null>(null);
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [telegramId, setTelegramId] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    setUser(session);
    if (session) {
      setTelegramId(session.telegramId || '');
    }
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const res = await updateUserSettings(user.id, {
      telegramId: telegramId || undefined,
      password: newPassword || undefined
    });

    if (res.success) {
      if (telegramId !== undefined && user) {
        const updatedUser = { ...user, telegramId: telegramId || undefined } as User;
        saveAuthSession(updatedUser);
        setUser(updatedUser);
      }
      toast({ title: "Settings Saved", description: "Your profile has been updated successfully!" });
      setIsSettingsOpen(false);
      setNewPassword('');
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not save settings." });
    }
  };

  if (pathname === '/') return null;

  return (
    <nav className="glass-nav sticky top-0 z-50 w-full">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">
            N
          </div>
          <span className="text-xl font-bold tracking-tight text-primary">NutriSnap</span>
        </Link>

        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <Link href="/admin">
              <Button variant="ghost" className="hidden md:flex gap-2 rounded-xl">
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[100px] truncate">{user?.name || 'User'}</span>
          </div>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Settings" className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40 text-primary">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none glass-card p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Account Settings</DialogTitle>
                <DialogDescription>Manage your security and integrations.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveSettings} className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Reset Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Enter new password to reset" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="rounded-xl" 
                  />
                </div>
                
                <div className="space-y-2 pt-2 border-t border-primary/10">
                  <Label htmlFor="telegram" className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Telegram Integration</Label>
                  <Input 
                    id="telegram" 
                    placeholder="Enter your Telegram ID (e.g. 123456789)" 
                    value={telegramId} 
                    onChange={e => setTelegramId(e.target.value)} 
                    className="rounded-xl" 
                  />
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mt-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>How to find your ID:</strong> Open Telegram, search for <span className="font-bold text-primary">@userinfobot</span>, and send the message <span className="font-mono bg-white/50 px-1 rounded">/start</span>. It will reply with your numeric ID. Paste it here to link your account to the NutriSnap bot!
                    </p>
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full h-11 rounded-xl shadow-lg shadow-primary/20">Save Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="icon" aria-label="Log out" onClick={handleLogout} className="rounded-full h-10 w-10 border-white/40 hover:bg-white/40">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
