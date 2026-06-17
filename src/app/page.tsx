
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { getMockUser, saveAuthSession } from '@/lib/auth-mock';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const user = getMockUser(email.toLowerCase());

    if (user) {
      saveAuthSession(user);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.name} (${user.role})`,
      });
      
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else if (!user.onboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } else {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "Please use 'user@nutrisnap.com' or 'admin@nutrisnap.com' for the demo.",
      });
      setLoading(false);
    }
  };

  const quickSelect = (val: string) => {
    setEmail(val);
  };

  return (
    <main className="min-h-svh flex items-center justify-center bg-slate-50/50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-headline font-bold text-3xl shadow-xl shadow-primary/20 rotate-3">
            N
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary mt-6">NutriSnap</h1>
          <p className="text-muted-foreground font-body">Sophisticated nutrition tracking for high performance.</p>
        </div>

        <Card className="border-none shadow-2xl shadow-primary/5 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-headline">Authentication</CardTitle>
            <CardDescription>Select a mock role to continue the prototype.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="user@nutrisnap.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted/30"
                  required 
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-medium group" disabled={loading}>
                {loading ? "Authenticating..." : (
                  <>
                    Sign In <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or quick select roles</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="flex flex-col h-auto py-3 px-2 gap-1 border-slate-200" onClick={() => quickSelect('user@nutrisnap.com')}>
                <UserCheck className="h-5 w-5 text-accent" />
                <span className="text-xs font-semibold">Standard User</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-auto py-3 px-2 gap-1 border-slate-200" onClick={() => quickSelect('admin@nutrisnap.com')}>
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold">Admin Panel</span>
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-center text-xs text-muted-foreground w-full">
              Experimental prototype. All data is stored locally.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
