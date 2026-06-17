
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAuthSession, saveAuthSession } from '@/lib/auth-mock';
import { useToast } from '@/hooks/use-toast';
import { resetPasswordSchema } from '@/lib/validation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.push('/');
    }
  }, [router]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const validation = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Policy Violation",
        description: validation.error.errors[0].message,
      });
      setLoading(false);
      return;
    }

    // In production, call API: await fetch('/api/auth/reset-password', ...)
    // Simulating success
    setTimeout(() => {
      const session = getAuthSession();
      if (session) {
        const updated = { ...session, requiresPasswordReset: false };
        saveAuthSession(updated);
        toast({
          title: "Identity Secured",
          description: "Your new password has been established. Session restored.",
        });
        router.push(session.role === 'ADMIN' ? '/admin' : '/dashboard');
      }
      setLoading(false);
    }, 1500);
  };

  return (
    <main className="min-h-svh flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Card className="border-none shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Mandatory Password Reset</CardTitle>
            <CardDescription>
              Your account is currently in recovery mode. A new complex password is required to continue.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Complex Password</Label>
                <Input 
                  id="new-password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
                <div className="text-[10px] text-muted-foreground space-y-1 pt-1">
                  <p className="flex items-center gap-1"><CheckCircle2 className={`h-2.5 w-2.5 ${password.length >= 12 ? 'text-emerald-500' : 'text-slate-300'}`} /> 12+ Characters</p>
                  <p className="flex items-center gap-1"><CheckCircle2 className={`h-2.5 w-2.5 ${/[A-Z]/.test(password) ? 'text-emerald-500' : 'text-slate-300'}`} /> Uppercase & Lowercase</p>
                  <p className="flex items-center gap-1"><CheckCircle2 className={`h-2.5 w-2.5 ${/[0-9]/.test(password) ? 'text-emerald-500' : 'text-slate-300'}`} /> Numerical value</p>
                  <p className="flex items-center gap-1"><CheckCircle2 className={`h-2.5 w-2.5 ${/[^A-Za-z0-9]/.test(password) ? 'text-emerald-500' : 'text-slate-300'}`} /> Special character</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Committing Changes..." : "Re-Secure Account"}
              </Button>
              <div className="p-3 bg-blue-50 text-blue-700 text-[10px] rounded-lg flex gap-2">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>By resetting your password, all existing active sessions for this account will be invalidated for security.</span>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
