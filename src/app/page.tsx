'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Leaf } from 'lucide-react';
import { saveAuthSession } from '@/lib/auth-mock';
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
        variant: 'destructive',
        title: 'Validation Error',
        description: validation.error.errors[0].message,
      });
      setLoading(false);
      return;
    }

    try {
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
        title: 'Signed in successfully',
        description: `Welcome back, ${data.name || 'User'}`,
      });

      // UI-3001 & UI-3002: Both onboarded ADMIN and USER land on /today
      if (data.requiresPasswordReset) {
        router.push('/reset-password');
      } else if (!data.onboarded) {
        router.push('/onboarding');
      } else {
        router.push('/today');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7FAF8] p-4 font-body">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto h-14 w-14 rounded-2xl bg-[#16A34A] flex items-center justify-center text-white shadow-md shadow-[#16A34A]/20"
            aria-hidden="true"
          >
            <Leaf className="h-7 w-7 fill-white/20" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827] mt-4">
            NutriSnap
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] font-normal max-w-xs mx-auto">
            Eat Well · Drink More · Manage Smart · Live Better
          </p>
        </div>

        {/* Auth card */}
        <Card className="border border-[#E5ECE8] shadow-[0_1px_3px_rgba(16,24,40,0.04)] bg-white rounded-[18px]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-[#111827]">
              Sign in to your account
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Enter your email and password to access your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#344054]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  aria-label="Email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] bg-white text-sm focus-visible:ring-[#16A34A]"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-[#344054]">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  aria-label="Password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-[10px] border-[#E5ECE8] bg-white text-sm focus-visible:ring-[#16A34A]"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-[10px] bg-[#16A34A] text-white hover:bg-[#0F7A38] shadow-xs transition-colors mt-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-[#667085]">
          NutriSnap v0.1 · Health &amp; Wealth Hub
        </div>
      </div>
    </main>
  );
}
