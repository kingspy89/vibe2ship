import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Issue } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  Search, MapPin, Bell, ClipboardList, Users, Clock, Gauge, 
  Sparkles, Flag, TrendingUp, Trophy, Zap, ChevronDown, CheckCircle2, ChevronRight, Share2, Filter
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export function Home() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState({ total: 0, resolved: 0 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const navigate = useNavigate();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    const q = query(collection(db, 'issues'), orderBy('priority_score', 'desc'));
    const unsubscribeIssues = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        issue_id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesData);
      
      let resolved = 0;
      issuesData.forEach(i => {
        if (i.status === 'Resolved') resolved++;
      });
      setStats({
        total: issuesData.length,
        resolved
      });
    });

    let reportsData: any[] = [];
    let verificationsData: any[] = [];
    let usersMap: Record<string, any> = {};

    const updateLeaderboard = () => {
      const userPoints: Record<string, number> = {};
      reportsData.forEach(r => {
        const uid = r.user_id;
        if (uid) {
          userPoints[uid] = (userPoints[uid] || 0) + 10;
        }
      });
      verificationsData.forEach(v => {
        const uid = v.user_id;
        if (uid) {
          userPoints[uid] = (userPoints[uid] || 0) + 5;
        }
      });

      const leaderboardData = Object.keys(userPoints).map(uid => ({
        id: uid,
        name: usersMap[uid]?.displayName || usersMap[uid]?.email?.split('@')[0] || (uid === 'anonymous' ? 'Anonymous Citizen' : 'Civic Hero'),
        points: userPoints[uid],
        col: uid === auth.currentUser?.uid ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400',
        isCurrentUser: uid === auth.currentUser?.uid
      })).sort((a, b) => b.points - a.points).slice(0, 5);
      
      setLeaderboard(leaderboardData);
    };

    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      reportsData = snap.docs.map(d => d.data());
      updateLeaderboard();
    });

    const unsubVerifications = onSnapshot(collection(db, 'verifications'), (snap) => {
      verificationsData = snap.docs.map(d => d.data());
      updateLeaderboard();
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap: Record<string, any> = {};
      snap.forEach(doc => {
        uMap[doc.id] = doc.data();
      });
      usersMap = uMap;
      updateLeaderboard();
    });

    return () => {
      unsubscribeIssues();
      unsubReports();
      unsubVerifications();
      unsubUsers();
    };
  }, []);

  const totalIssues = issues.length;

  const filteredIssues = issues.filter(issue => {
    const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter;
    let matchesSeverity = true;
    if (severityFilter === 'high') {
      matchesSeverity = issue.severity_score >= 4;
    } else if (severityFilter === 'medium') {
      matchesSeverity = issue.severity_score === 3;
    } else if (severityFilter === 'low') {
      matchesSeverity = issue.severity_score <= 2;
    }
    return matchesCategory && matchesSeverity;
  });

  const categoryCounts = issues.reduce((acc, curr) => {
    const cat = curr.category.replace('_', ' ');
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trends = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => {
       const pct = totalIssues > 0 ? (count / totalIssues) * 100 : 0;
       const icon = name.toLowerCase().includes('garbage') ? '♻️' : name.toLowerCase().includes('water') ? '💧' : name.toLowerCase().includes('pothole') ? '🚧' : name.toLowerCase().includes('light') ? '💡' : '🕳️';
       const color = name.toLowerCase().includes('garbage') ? 'bg-emerald-500' : name.toLowerCase().includes('water') ? 'bg-blue-500' : name.toLowerCase().includes('pothole') ? 'bg-red-500' : name.toLowerCase().includes('light') ? 'bg-amber-500' : 'bg-purple-500';
       return {
         name: name.charAt(0).toUpperCase() + name.slice(1),
         icon,
         color,
         pct: `${pct}%`,
         trend: `${count} reports`,
         tColor: 'text-indigo-400'
       }
    });

  const getPinColor = (category: string, severity: number) => {
    if (severity >= 4) return '#ef4444'; // Red
    if (category === 'pothole') return '#f59e0b';
    if (category === 'water_leakage') return '#3b82f6';
    if (category === 'garbage') return '#10b981';
    return '#8b5cf6';
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'pothole': return 'A';
      case 'water_leakage': return '💧';
      case 'garbage': return '🗑️';
      default: return '⚡';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Reported': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Community Verified': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Acknowledged': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'In Progress': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
      case 'Resolved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-[#1C1D26] border border-slate-800 rounded-lg px-4 py-2.5 flex items-center space-x-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4 text-indigo-400" />
            <span>Koramangala, Bengaluru</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
          <div className="bg-[#1C1D26] border border-slate-800 rounded-lg px-4 py-2.5 flex items-center space-x-2 w-96">
            <Search className="h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search location, issue, or issue ID..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-300 placeholder:text-slate-600"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Bell className="h-5 w-5 text-slate-400" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-[#12131A]"></span>
          </div>
          <div className="flex items-center space-x-2">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Malav" className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="text-xs">
              <div className="font-bold text-white">Malav</div>
              <div className="text-slate-500">Level 12 • Verified Local</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="h-12 w-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Reports Received</div>
              <div className="text-2xl font-bold text-white">340 <span className="text-xs font-normal text-emerald-400 ml-2">↑ 16% w/w</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Unique Issues</div>
              <div className="text-2xl font-bold text-white">{issues.length} <span className="text-xs font-normal text-emerald-400 ml-2">↑ 12% w/w</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Avg. Resolution Time</div>
              <div className="text-2xl font-bold text-white">4.2 <span className="text-sm font-normal text-slate-400">days</span> <span className="text-xs font-normal text-emerald-400 ml-2">↓ 8% w/w</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="h-12 w-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Gauge className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Civic Score</div>
              <div className="text-2xl font-bold text-white">76% <span className="text-xs font-normal text-emerald-400 ml-2">↑ 15% w/w</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Left Column */}
        <div className="col-span-8 space-y-6">
          {/* Map Container */}
          <Card className="bg-[#1C1D26] border-slate-800/50 overflow-hidden flex flex-col h-[500px]">
            <div className="px-4 py-3 border-b border-slate-800/50 flex flex-wrap justify-between items-center bg-[#1C1D26] z-10 gap-2">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="font-semibold text-sm text-slate-200">Live Issue Map</span>
                <span className="text-xs text-slate-500 px-2 py-0.5 rounded bg-slate-800/50">Real-time</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#12131A] border border-slate-800 text-xs text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="pothole">Potholes</option>
                  <option value="streetlight">Streetlights</option>
                  <option value="garbage">Waste/Garbage</option>
                  <option value="water_leakage">Water Leakage</option>
                  <option value="other">Other</option>
                </select>

                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-[#12131A] border border-slate-800 text-xs text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="high">High (4-5)</option>
                  <option value="medium">Medium (3)</option>
                  <option value="low">Low (1-2)</option>
                </select>
              </div>
            </div>
            <div className="flex-1 relative">
              {apiKey ? (
                <APIProvider apiKey={apiKey}>
                  <Map
                    defaultCenter={{ lat: 12.9352, lng: 77.6245 }}
                    defaultZoom={13}
                    mapId="civicpulse-dark-map"
                    disableDefaultUI={false}
                    gestureHandling="greedy"
                  >
                    {filteredIssues.map(issue => (
                      <AdvancedMarker 
                        key={issue.issue_id} 
                        position={{ lat: issue.lat, lng: issue.lng }}
                        onClick={() => navigate(`/issue/${issue.issue_id}`)}
                      >
                        <div 
                          className="flex items-center justify-center text-white text-xs font-bold rounded-full border-2 border-[#1C1D26] shadow-lg transform transition-transform hover:scale-110"
                          style={{
                            backgroundColor: getPinColor(issue.category, issue.severity_score),
                            width: issue.report_count > 10 ? '40px' : '30px',
                            height: issue.report_count > 10 ? '40px' : '30px',
                            boxShadow: `0 0 15px ${getPinColor(issue.category, issue.severity_score)}66`
                          }}
                        >
                          {issue.report_count}
                        </div>
                      </AdvancedMarker>
                    ))}
                  </Map>
                </APIProvider>
              ) : (
                <div className="h-full w-full bg-slate-900 flex items-center justify-center text-slate-500 text-sm">
                  Map API Key missing
                </div>
              )}

              {/* Map Legend */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                <div className="flex space-x-2 bg-[#1C1D26]/90 backdrop-blur border border-slate-800/50 p-2 rounded-lg pointer-events-auto">
                  <div className="flex items-center space-x-1.5 px-2 text-xs text-slate-300">
                    <div className="h-3 w-3 rounded bg-purple-500"></div> <span>All Issues</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-2 text-xs text-slate-300">
                    <div className="h-3 w-3 rounded bg-red-500"></div> <span>Road</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-2 text-xs text-slate-300">
                    <div className="h-3 w-3 rounded bg-blue-500"></div> <span>Water</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-2 text-xs text-slate-300">
                    <div className="h-3 w-3 rounded bg-amber-500"></div> <span>Electricity</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-2 text-xs text-slate-300">
                    <div className="h-3 w-3 rounded bg-emerald-500"></div> <span>Waste</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Issue Status Flow */}
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-200">Issue Status Flow</CardTitle>
              <p className="text-xs text-slate-500">Track the lifecycle of an issue</p>
            </CardHeader>
            <CardContent>
              <div className="relative flex justify-between pt-6 pb-2">
                <div className="absolute top-9 left-[10%] right-[10%] h-0.5 bg-slate-800"></div>
                
                {[
                  { label: 'Reported', desc: 'Anyone can report issue', icon: '📝', color: 'bg-purple-500' },
                  { label: 'Community Verified', desc: 'Verified by locals in the area', icon: '👥', color: 'bg-indigo-500' },
                  { label: 'Acknowledged', desc: 'Authority acknowledges', icon: '👁️', color: 'bg-blue-500' },
                  { label: 'In Progress', desc: 'Work has started', icon: '🚧', color: 'bg-emerald-500' },
                  { label: 'Resolved', desc: 'Issue fixed & closed', icon: '✅', color: 'bg-slate-700' }
                ].map((step, i) => (
                  <div key={i} className="relative flex flex-col items-center w-1/5 z-10 text-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#1C1D26] mb-2 ${i < 3 ? step.color : 'bg-slate-800 text-slate-500'}`}>
                      <span className="text-xs">{step.icon}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-300">{step.label}</div>
                    <div className="text-[10px] text-slate-500 mt-1 max-w-[80px] leading-tight">{step.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardContent className="p-4 flex items-center space-x-6">
              <div className="flex items-center space-x-2 shrink-0">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-200">Recent Activity</span>
                <Badge variant="outline" className="text-[10px] py-0 border-slate-700 ml-2 text-slate-400">Real-time updates</Badge>
              </div>
              <div className="flex-1 flex space-x-6 overflow-hidden">
                <div className="flex items-start space-x-2 text-xs truncate">
                  <div className="bg-amber-500/20 text-amber-500 p-1 rounded"><Flag className="h-3 w-3" /></div>
                  <div>
                    <span className="text-slate-300">Issue #87 (Pothole)</span> in 5th Cross Road status changed to <span className="text-indigo-400">In Progress</span>
                    <div className="text-slate-500 text-[10px] mt-0.5">2m ago</div>
                  </div>
                </div>
                <div className="flex items-start space-x-2 text-xs truncate">
                  <div className="bg-emerald-500/20 text-emerald-500 p-1 rounded"><CheckCircle2 className="h-3 w-3" /></div>
                  <div>
                    <span className="text-slate-300">Issue #65 (Water Leakage)</span> in 8th Main a new verification added
                    <div className="text-slate-500 text-[10px] mt-0.5">5m ago</div>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 text-indigo-400 text-xs">View All Activity →</Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="col-span-4 space-y-6">
          {/* Issue Intelligence */}
          {filteredIssues.length > 0 && (
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center text-slate-200">
                <Sparkles className="h-4 w-4 mr-2 text-indigo-400" /> Issue Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-1/2 aspect-video rounded-lg overflow-hidden bg-slate-800 relative flex items-center justify-center">
                  <div className="absolute inset-0 border border-red-500/50 m-2 border-dashed rounded flex flex-col justify-center text-center p-2">
                    <span className="text-[10px] text-slate-400 block line-clamp-4">{filteredIssues[0].auto_description}</span>
                  </div>
                </div>
                <div className="w-1/2 space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Issue Category</div>
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 font-normal text-xs py-0 capitalize text-center leading-tight h-auto">⚠️ {filteredIssues[0].category.replace('_', ' ')}</Badge>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Severity Score</span>
                      <span className="text-red-400 font-bold">{filteredIssues[0].severity_score} / 5</span>
                    </div>
                    <div className="flex space-x-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= filteredIssues[0].severity_score ? 'bg-red-500' : 'bg-slate-800'}`}></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>AI Confidence</span>
                      <span className="text-indigo-400 font-bold">98%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full w-full">
                      <div className="h-1.5 bg-indigo-500 rounded-full w-[98%] transition-all"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-start space-x-3">
                <div className="bg-indigo-50 text-white rounded-full p-1 shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-indigo-300">Clustered Intelligence</div>
                  <p className="text-[10px] text-indigo-400/80 mt-1">Merged with {filteredIssues[0].report_count - 1} reports. Primary Issue: {filteredIssues[0].auto_title}</p>
                </div>
                <Share2 className="h-4 w-4 text-indigo-400/50 shrink-0 ml-auto" />
              </div>
            </CardContent>
          </Card>
          )}

          {/* Priority Queue */}
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center text-slate-200">
                <Flag className="h-4 w-4 mr-2 text-indigo-400" /> Priority Queue
              </CardTitle>
              <span className="text-xs text-indigo-400 cursor-pointer hover:underline">View All</span>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 border-b border-slate-800/50">
                    <tr>
                      <th className="pb-2 font-normal">#</th>
                      <th className="pb-2 font-normal">Issue</th>
                      <th className="pb-2 font-normal">Location</th>
                      <th className="pb-2 font-normal">Severity</th>
                      <th className="pb-2 font-normal">Reports</th>
                      <th className="pb-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredIssues.slice(0, 5).map((issue, i) => (
                      <tr key={issue.issue_id} className="hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate(`/issue/${issue.issue_id}`)}>
                        <td className="py-2.5 text-slate-500">{i + 1}</td>
                        <td className="py-2.5 font-medium text-slate-300 flex items-center space-x-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${issue.severity_score >= 4 ? 'bg-amber-500' : 'bg-slate-500'}`}></div>
                          <span className="capitalize">{issue.category.replace('_', ' ')}</span>
                        </td>
                        <td className="py-2.5 text-slate-400 truncate max-w-[120px]" title={issue.auto_title}>{issue.auto_title}</td>
                        <td className="py-2.5 text-red-400 font-medium">{issue.severity_score}</td>
                        <td className="py-2.5 text-slate-400">{issue.report_count}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border border-transparent ${issue.status === 'Resolved' ? 'text-emerald-400 bg-emerald-400/10' : issue.status === 'Reported' ? 'text-red-400 bg-red-400/10' : 'text-indigo-400 bg-indigo-400/10'}`}>{issue.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            {/* Trending Issues */}
            <Card className="bg-[#1C1D26] border-slate-800/50">
              <CardHeader className="pb-2 flex flex-row justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-200">Trending Issues</CardTitle>
                  <p className="text-[10px] text-slate-500 mt-0.5">This week vs last week</p>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center cursor-pointer">Hyperlocal Trends <ChevronDown className="h-3 w-3 ml-1"/></div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {trends.length === 0 && <div className="text-xs text-slate-500 text-center py-4">No data yet</div>}
                {trends.map((item, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <span className="text-[10px]">{item.icon}</span>
                        <span>{item.name}</span>
                      </div>
                      <span className={item.tColor}>{item.trend}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full w-full">
                      <div className={`h-1 rounded-full ${item.color} transition-all duration-1000`} style={{ width: item.pct }}></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Community Leaderboard */}
            <Card className="bg-[#1C1D26] border-slate-800/50">
              <CardHeader className="pb-2 flex flex-row justify-between items-center">
                <CardTitle className="text-sm font-semibold text-slate-200">Community Leaderboard</CardTitle>
                <div className="text-[10px] text-slate-400 flex items-center cursor-pointer">All Time <ChevronDown className="h-3 w-3 ml-1"/></div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3 mb-4">
                  {leaderboard.length === 0 && <div className="text-xs text-slate-500 text-center py-4">No points yet</div>}
                  {leaderboard.map((user, index) => (
                    <div key={user.id} className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold ${index === 0 ? 'bg-amber-500 text-amber-900' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-700 text-amber-100' : user.col}`}>
                          {index + 1}
                        </div>
                        <div className="h-5 w-5 rounded-full bg-slate-700 overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                        </div>
                        <span className={user.isCurrentUser ? 'text-indigo-300 font-medium' : 'text-slate-300'}>
                          {user.name} {user.isCurrentUser && '(You)'}
                        </span>
                      </div>
                      <span className="text-slate-400">{user.points} pts</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-[#2A2B36] rounded-lg p-3 text-center border border-slate-700/50 relative overflow-hidden">
                  <Trophy className="h-8 w-8 text-amber-400 mx-auto mb-1 opacity-80" />
                  <p className="text-[10px] text-slate-300 mb-2 z-10 relative">Keep it up! Civic Heroes change the world!</p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/leaderboard')} className="w-full text-[10px] h-6 border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 z-10 relative">
                    View Leaderboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Floating Report Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Link to="/report">
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white h-16 w-16 rounded-full shadow-lg shadow-indigo-600/30 flex flex-col items-center justify-center transition-transform hover:scale-105 border border-indigo-400/30">
            <span className="text-xl font-light leading-none mb-1">+</span>
            <span className="text-[10px] font-medium leading-none">Report</span>
            <span className="text-[10px] font-medium leading-none">Issue</span>
          </button>
        </Link>
      </div>
    </div>
  );
}
