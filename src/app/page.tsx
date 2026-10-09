'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mail, Lock, ShieldCheck, Calendar, Utensils, IndianRupee } from 'lucide-react';
import { Brand } from '@/components/design-system/Brand';
import { saveAuthSession } from '@/lib/auth-mock';
import { useToast } from '@/hooks/use-toast';
import { loginSchema } from '@/lib/validation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      // Both onboarded ADMIN and USER land on /today
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
    <main className="min-h-screen w-full flex flex-col lg:flex-row items-stretch bg-white font-body selection:bg-[#F5F3FF] selection:text-[#6D28D9]">
      {/* LEFT SIDE: Promotional Canvas (Desktop 1440px reference) */}
      <div className="relative w-full lg:w-1/2 bg-[#FAFAFC] border-b lg:border-b-0 lg:border-r border-[#E2E8F0] flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-hidden">
        {/* Top Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Brand size="md" href="/" />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE] text-xs font-semibold">
            Health &amp; Wealth OS
          </span>
        </div>

        {/* Central Promotional Content */}
        <div className="relative z-10 my-8 lg:my-12 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE] text-xs font-semibold mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6D28D9]" />
            <span>Unified Energy &amp; Capital Protocol</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1E293B] mb-3 text-balance leading-tight">
            Precision nutrition and mindful daily budget habits in one seamless routine.
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] max-w-lg mb-8 leading-relaxed">
            Synchronize your daily meals, water tracking, accounts, and financial obligations in one calm, clinical 2D workspace.
          </p>

          {/* Daily Convergence Preview Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] hover:shadow-[0_4px_6px_-1px_rgba(15,23,42,0.07),0_2px_4px_-2px_rgba(15,23,42,0.04)] transition-all">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#6D28D9]" />
                <span className="text-xs font-semibold text-[#1E293B]">Today&apos;s Daily Convergence</span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] text-[11px] font-semibold">
                On Pace
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Calorie Stream */}
              <div className="p-3.5 rounded-xl bg-[#FAFAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#64748B]">Calorie Intake</span>
                    <span className="text-xs font-semibold text-[#6D28D9]">59%</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-xl sm:text-2xl font-bold text-[#1E293B] tabular-nums">1,310</span>
                    <span className="text-xs text-[#64748B] font-medium">/ 2,200 kcal</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#6D28D9] h-1.5 rounded-full" style={{ width: '59.5%' }} />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#64748B]">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                      Protein
                    </span>
                    <span className="font-semibold text-[#1E293B] tabular-nums">95g / 140g</span>
                  </div>
                </div>
              </div>

              {/* Spend Cap Stream */}
              <div className="p-3.5 rounded-xl bg-[#FAFAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#64748B]">Daily Spend Cap</span>
                    <span className="text-xs font-semibold text-[#6D28D9]">53%</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-xl sm:text-2xl font-bold text-[#1E293B] tabular-nums">₹850</span>
                    <span className="text-xs text-[#64748B] font-medium">/ ₹1,600 INR</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#6D28D9] h-1.5 rounded-full" style={{ width: '53.1%' }} />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#64748B]">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                      Remaining Buffer
                    </span>
                    <span className="font-semibold text-[#059669] tabular-nums">₹750 INR</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Micro Metrics Strip */}
            <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]">
              <span className="flex items-center gap-1.5">
                <Utensils className="h-3.5 w-3.5 text-[#6D28D9]" />
                Nutritious meals logged
              </span>
              <span className="flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5 text-[#6D28D9]" />
                Direct bank &amp; card sync
              </span>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#64748B] pt-4 border-t border-[#E2E8F0]/60">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#059669]" />
            256-bit encrypted health &amp; financial logs
          </span>
          <span className="font-medium text-[#94A3B8]">NutriSnap V0.3</span>
        </div>
      </div>

      {/* RIGHT SIDE: Login Surface */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        {/* Top Header Link */}
        <div className="flex justify-end items-center w-full">
          <Link
            href="/reset-password"
            className="text-xs font-medium text-[#64748B] hover:text-[#6D28D9] transition-colors py-1 px-2 rounded-lg hover:bg-[#F5F3FF]"
          >
            Trouble signing in?
          </Link>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-8">
          <div className="text-left mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center mb-4 border border-[#DDD6FE]">
              <Lock className="h-6 w-6 text-[#6D28D9]" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1E293B] mb-1.5">
              Welcome back
            </h2>
            <p className="text-sm text-[#64748B]">
              Enter your credentials to access your daily nutrition and wealth overview.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#1E293B]">
                Email Address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  aria-label="Email Address"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 px-3.5 pr-10 rounded-xl border-[#E2E8F0] bg-white text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:border-[#6D28D9]"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#64748B]">
                  <Mail className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1E293B]">
                  Password
                </Label>
                <Link
                  href="/reset-password"
                  className="text-xs font-medium text-[#6D28D9] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 px-3.5 pr-10 rounded-xl border-[#E2E8F0] bg-white text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:border-[#6D28D9]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#64748B] hover:text-[#1E293B] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-sm font-semibold rounded-xl bg-[#6D28D9] text-white hover:bg-[#5B21B6] active:scale-[0.99] transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[#6D28D9] focus-visible:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
          </form>

          {/* Quick Demo Hint */}
          <div className="mt-6 pt-5 border-t border-[#F1F5F9] text-center text-xs text-[#64748B]">
            Default test account: <span className="font-semibold text-[#1E293B]">admin@nutrisnap.com</span>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="text-center text-xs text-[#94A3B8]">
          NutriSnap OS · Precision Health &amp; Wealth Hub
        </div>
      </div>
    </main>
  );
}
