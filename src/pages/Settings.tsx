import { useAuth } from '../components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      <Card className="bg-[#1C1D26] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-200">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-slate-700 overflow-hidden">
              <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || user?.email}`} alt="avatar" />
            </div>
            <div>
              <p className="font-medium text-slate-200">{user?.displayName || 'Citizen'}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-800/50">
            <Button variant="outline" onClick={() => logout()} className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-[#1C1D26] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-200">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">You will receive notifications for updates on issues you report.</p>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="email-notif" className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50" defaultChecked />
            <label htmlFor="email-notif" className="text-sm text-slate-300">Email Notifications</label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
