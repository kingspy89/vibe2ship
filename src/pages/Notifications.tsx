import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Bell, Check, Trash2, ExternalLink, MessageSquare, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(data.sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        if (!n.read) {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('verify') || t.includes('confirm')) return <CheckCircle2 className="h-5 w-5 text-indigo-400" />;
    if (t.includes('merge') || t.includes('cluster')) return <MessageSquare className="h-5 w-5 text-purple-400" />;
    if (t.includes('urgency') || t.includes('severity') || t.includes('hazard')) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <Info className="h-5 w-5 text-blue-400" />;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 animate-pulse">
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">Updates on your reported issues and community activity.</p>
        </div>
        {unreadCount > 0 && (
          <Button 
            onClick={handleMarkAllAsRead} 
            variant="outline" 
            size="sm" 
            className="text-xs border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20"
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardContent className="p-12 text-center text-slate-400 flex flex-col items-center">
            <Bell className="h-16 w-16 text-slate-800 mb-4" />
            <h3 className="font-bold text-slate-300 text-lg mb-1">Inbox is Empty</h3>
            <p className="text-sm text-slate-500">You will receive notifications here when your issues are updated or verified.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card 
              key={notif.id} 
              className={`border-slate-800/50 transition-colors ${notif.read ? 'bg-[#1C1D26]/70' : 'bg-[#1C1D26] border-l-2 border-l-indigo-500'}`}
            >
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${notif.read ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-800 text-white'}`}>
                    {getIcon(notif.title)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm truncate ${notif.read ? 'text-slate-400' : 'font-bold text-slate-200'}`}>
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed ${notif.read ? 'text-slate-500' : 'text-slate-300'}`}>
                      {notif.message}
                    </p>
                    <div className="text-[10px] text-slate-500 pt-1">
                      {formatDistanceToNow(notif.created_at)} ago
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {notif.issue_id && (
                    <Link to={`/issue/${notif.issue_id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" title="View Ticket">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  {!notif.read && (
                    <Button 
                      onClick={() => handleMarkAsRead(notif.id)} 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-indigo-400 hover:text-indigo-300"
                      title="Mark as Read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleDelete(notif.id)} 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-500 hover:text-red-400"
                    title="Delete Notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
