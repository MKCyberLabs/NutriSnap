
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { getAuthSession } from '@/lib/auth-mock';
import { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, ShieldAlert, BarChart3 } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    if (!session || session.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    setUser(session);
  }, [router]);

  return (
    <div className="min-h-svh bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-bold text-primary">System Administration</h1>
          <p className="text-muted-foreground">Global overview and user management.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-2xl flex items-center justify-between">
                1,284 <Users className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Daily Active</CardDescription>
              <CardTitle className="text-2xl flex items-center justify-between">
                429 <Activity className="h-5 w-5 text-green-500" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>GenAI Token Usage</CardDescription>
              <CardTitle className="text-2xl flex items-center justify-between">
                12.4k <BarChart3 className="h-5 w-5 text-accent" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>System Alerts</CardDescription>
              <CardTitle className="text-2xl flex items-center justify-between">
                0 <ShieldAlert className="h-5 w-5 text-slate-300" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Recent User Registrations</CardTitle>
            <CardDescription>Prototype view of user metrics intake.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-right">Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Alex Johnson</TableCell>
                  <TableCell><Badge variant="outline">USER</Badge></TableCell>
                  <TableCell><Badge className="bg-green-500">Active</Badge></TableCell>
                  <TableCell>175cm / 70kg / 28y</TableCell>
                  <TableCell className="text-right">Logged Breakfast</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Sarah Miller</TableCell>
                  <TableCell><Badge variant="outline">USER</Badge></TableCell>
                  <TableCell><Badge className="bg-green-500">Active</Badge></TableCell>
                  <TableCell>162cm / 58kg / 32y</TableCell>
                  <TableCell className="text-right">Logged Snack</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Admin User</TableCell>
                  <TableCell><Badge variant="outline">ADMIN</Badge></TableCell>
                  <TableCell><Badge className="bg-blue-500">System</Badge></TableCell>
                  <TableCell>N/A</TableCell>
                  <TableCell className="text-right">System Config</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
