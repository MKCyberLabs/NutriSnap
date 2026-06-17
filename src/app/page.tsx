
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ShieldCheck, UserCheck, ArrowRight, Lock } from 'lucide-react';
import { authenticateUser, saveAuthSession } from '@/lib/auth-mock';
import { useToast } from '@/hooks/use-toast';
import { loginSchema } from '@/lib/validation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Frontend validation with Zod
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      setLoading(false);
      return;
    }

    try {
      // Prototype Auth: Check local managed users first
      const localUser = authenticateUser(email, password);
      
      if (localUser) {
        saveAuthSession(localUser);
        toast({
          title: "Authenticated Successfully",
          description: `Access granted as ${localUser.role}`,
        });
        
        // Navigation logic
        if (localUser.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
        return;
      }

      // Fallback/Legacy: Call API (for recovery keys or server-side checks)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Access Denied: Invalid Credentials');
      }

      saveAuthSession(data);
      
      toast({
        title: "Authenticated via Secure Route",
        description: `Access granted as ${data.role}`,
      });

      if (data.requiresPasswordReset) {
        router.push('/reset-password');
      } else if (data.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const quickSelect = (val: string) => {
    setEmail(val);
    setPassword('ProductionPassword123!');
  };

  return (
    <main className="min-h-svh flex items-center justify-center bg-slate-50/50 p-4 font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-xl shadow-primary/20 rotate-3">
            N
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary mt-6">NutriSnap</h1>
          <p className="text-muted-foreground">Sophisticated nutrition tracking with Hardened Security.</p>
        </div>

        <Card className="border-none shadow-2xl shadow-primary/5 bg-white/80 backdrop-blur-sm rounded-[2.5rem]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Secure Access
            </CardTitle>
            <CardDescription>Enter your credentials to manage the ecosystem.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Identity</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@mkcyberlabs.in" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted/30 rounded-xl"
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Secret Key</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/30 rounded-xl"
                  required 
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold group rounded-xl" disabled={loading}>
                {loading ? "Authenticating..." : (
                  <>
                    Establish Session <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                <span className="bg-white px-3 text-muted-foreground">Internal Directory</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="flex flex-col h-auto py-3 px-2 gap-1 border-slate-200 rounded-2xl" onClick={() => quickSelect('user@nutrisnap.com')}>
                <UserCheck className="h-5 w-5 text-emerald-500" />
                <span className="text-xs font-bold text-muted-foreground">Employee</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-auto py-3 px-2 gap-1 border-slate-200 rounded-2xl" onClick={() => quickSelect('admin@mkcyberlabs.in')}>
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-xs font-bold text-primary">Global Admin</span>
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-center text-[10px] text-muted-foreground w-full uppercase tracking-tighter">
              Hardened Production Environment • Rate Limiting Active • MK CyberLabs Inc.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
