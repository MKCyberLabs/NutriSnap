
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { getAuthSession, saveAuthSession } from '@/lib/auth-mock';
import { updateUserMetrics } from '@/ai/actions/db-users';
import { useToast } from '@/hooks/use-toast';
import { Ruler, Weight, CalendarDays, CheckCircle2, User as UserIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState({
    height: '',
    weight: '',
    age: '',
    gender: 'male' as 'male' | 'female',
  });

  useEffect(() => {
    const session = getAuthSession();
    if (!session) router.push('/');
    if (session?.onboarded) router.push('/today');
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const session = getAuthSession();
    if (session) {
      const updatedUser = {
        ...session,
        onboarded: true,
        metrics: {
          height: Number(metrics.height),
          weight: Number(metrics.weight),
          age: Number(metrics.age),
          gender: metrics.gender,
        }
      };
      saveAuthSession(updatedUser);
      if (session.id) { updateUserMetrics(session.id, updatedUser.metrics); }
      toast({
        title: "Setup Complete!",
        description: "Your health profile has been personalized.",
      });
      router.push('/today');
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1E293B] mb-2 tracking-tight">Initialize Wellness</h2>
          <p className="text-sm text-[#64748B]">We&apos;ll use these metrics to calculate your daily nutritional targets.</p>
        </div>

        <Card className="border border-[#E2E8F0] rounded-2xl shadow-[0_1px_3px_0_rgba(15,23,42,0.05),0_1px_2px_-1px_rgba(15,23,42,0.03)] bg-white">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1E293B]">Health Metrics</CardTitle>
              <CardDescription className="text-xs text-[#64748B]">Input your current stats for precision tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold text-[#1E293B]">
                  <UserIcon className="h-4 w-4 text-[#6D28D9]" /> Gender
                </Label>
                <Select 
                  value={metrics.gender} 
                  onValueChange={(val: 'male' | 'female') => setMetrics({...metrics, gender: val})}
                >
                  <SelectTrigger aria-label="Select gender" className="w-full h-11 rounded-xl border-[#E2E8F0] text-sm">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height" className="flex items-center gap-2 text-xs font-semibold text-[#1E293B]">
                    <Ruler className="h-4 w-4 text-[#6D28D9]" /> Height (cm)
                  </Label>
                  <Input 
                    id="height" 
                    type="number" 
                    placeholder="175" 
                    value={metrics.height}
                    onChange={(e) => setMetrics({...metrics, height: e.target.value})}
                    required 
                    min="50"
                    max="300"
                    className="h-11 rounded-xl border-[#E2E8F0] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight" className="flex items-center gap-2 text-xs font-semibold text-[#1E293B]">
                    <Weight className="h-4 w-4 text-[#6D28D9]" /> Weight (kg)
                  </Label>
                  <Input 
                    id="weight" 
                    type="number" 
                    placeholder="70" 
                    value={metrics.weight}
                    onChange={(e) => setMetrics({...metrics, weight: e.target.value})}
                    required 
                    min="20"
                    max="500"
                    className="h-11 rounded-xl border-[#E2E8F0] text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="age" className="flex items-center gap-2 text-xs font-semibold text-[#1E293B]">
                  <CalendarDays className="h-4 w-4 text-[#6D28D9]" /> Age
                </Label>
                <Input 
                  id="age" 
                  type="number" 
                  placeholder="28" 
                  value={metrics.age}
                  onChange={(e) => setMetrics({...metrics, age: e.target.value})}
                  required 
                  min="1"
                  max="120"
                  className="h-11 rounded-xl border-[#E2E8F0] text-sm"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white transition-all shadow-sm">
                Complete Setup <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-[#64748B] text-center">
                Your data is securely stored in your private database.
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
