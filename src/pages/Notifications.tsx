import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Bell } from 'lucide-react';

export function Notifications() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Notifications</h1>
        <p className="text-sm text-slate-400 mt-1">Updates on your reported issues and community activity.</p>
      </div>

      <Card className="bg-[#1C1D26] border-slate-800/50">
        <CardContent className="p-8 text-center text-slate-400 flex flex-col items-center">
          <Bell className="h-12 w-12 text-slate-700 mb-4" />
          <p>No new notifications at this time.</p>
        </CardContent>
      </Card>
    </div>
  );
}
