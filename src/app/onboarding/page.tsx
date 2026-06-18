
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
    if (session?.onboarded) router.push('/dashboard');
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
      router.push('/dashboard');
    }
  };

  return (
    <main className="min-h-svh bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h2 className="font-headline text-3xl font-bold text-primary mb-2">Initialize Wellness</h2>
          <p className="text-muted-foreground font-body">We'll use these metrics to calculate your daily nutritional targets.</p>
        </div>

        <Card className="border-none shadow-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="font-headline">Health Metrics</CardTitle>
              <CardDescription>Input your current stats for precision tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-accent" /> Gender
                </Label>
                <Select 
                  value={metrics.gender} 
                  onValueChange={(val: 'male' | 'female') => setMetrics({...metrics, gender: val})}
                >
                  <SelectTrigger className="w-full">
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
                  <Label htmlFor="height" className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-accent" /> Height (cm)
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight" className="flex items-center gap-2">
                    <Weight className="h-4 w-4 text-accent" /> Weight (kg)
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
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="age" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-accent" /> Age
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
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full h-12 text-lg">
                Complete Setup <CheckCircle2 className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Your data is stored locally on this device for privacy.
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
