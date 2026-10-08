import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function Analytics() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'issues'), (snap) => {
      setIssues(snap.docs.map(doc => doc.data()));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const statusData = [
    { name: 'Reported', value: issues.filter(i => i.status === 'Reported').length },
    { name: 'Verified', value: issues.filter(i => i.status === 'Community Verified').length },
    { name: 'Resolved', value: issues.filter(i => i.status === 'Resolved').length },
  ].filter(d => d.value > 0);

  const categoryCounts = issues.reduce((acc, curr) => {
    const cat = (curr.category || '').replace('_', ' ');
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.keys(categoryCounts).map(k => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: categoryCounts[k]
  }));

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendsByMonth: Record<string, { reported: number, resolved: number }> = {};
  
  issues.forEach(issue => {
    if (!issue.created_at) return;
    const date = new Date(issue.created_at);
    const monthStr = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    if (!trendsByMonth[monthStr]) {
      trendsByMonth[monthStr] = { reported: 0, resolved: 0 };
    }
    trendsByMonth[monthStr].reported += 1;
    if (issue.status === 'Resolved') {
      trendsByMonth[monthStr].resolved += 1;
    }
  });

  const trendData = Object.keys(trendsByMonth).map(month => ({
    month,
    reported: trendsByMonth[month].reported,
    resolved: trendsByMonth[month].resolved,
  }));

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">System Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Deep dive into issue reporting and resolution metrics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader>
              <div className="h-6 w-48 bg-slate-800 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="h-80 flex flex-col justify-end space-y-4">
              <div className="flex items-end justify-between h-full px-4">
                <div className="w-[10%] h-[30%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[10%] h-[50%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[10%] h-[70%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[10%] h-[40%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[10%] h-[90%] bg-slate-800 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader>
              <div className="h-6 w-48 bg-slate-800 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="h-80 flex justify-center items-center">
              <div className="w-48 h-48 rounded-full border-[12px] border-slate-800 border-t-slate-700 animate-spin"></div>
            </CardContent>
          </Card>

          <Card className="col-span-1 md:col-span-2 bg-[#1C1D26] border-slate-800/50">
            <CardHeader>
              <div className="h-6 w-48 bg-slate-800 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="h-80 flex flex-col justify-end space-y-4">
              <div className="flex items-end justify-between h-full px-10">
                <div className="w-[8%] h-[60%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[8%] h-[20%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[8%] h-[80%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[8%] h-[40%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[8%] h-[90%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[8%] h-[50%] bg-slate-800 rounded animate-pulse"></div>
                <div className="w-[8%] h-[30%] bg-slate-800 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">System Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Deep dive into issue reporting and resolution metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-200">Reporting vs Resolution Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="reported" stroke="#6366f1" strokeWidth={2} name="Reported" dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-200">Current Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex justify-center items-center">
            {issues.length > 0 && statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} itemStyle={{ color: '#f1f5f9' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-200">Issues by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#334155'}} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Total Reports" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
