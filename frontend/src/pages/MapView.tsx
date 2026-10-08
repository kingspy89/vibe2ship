import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useApiIsLoaded } from '@vis.gl/react-google-maps';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue } from '../types';
import { useNavigate, NavigateFunction } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

function MapContent({ issues, navigate, getPinColor }: { issues: Issue[], navigate: NavigateFunction, getPinColor: (severity: number) => string }) {
  const apiIsLoaded = useApiIsLoaded();

  if (!apiIsLoaded) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
        <p>Loading map...</p>
      </div>
    );
  }

  return (
    <Map
      defaultCenter={{ lat: 12.9352, lng: 77.6245 }} // Default to Koramangala, Bangalore
      defaultZoom={13}
      mapId="civicpulse-map-id"
      disableDefaultUI={false}
      gestureHandling="greedy"
    >
      {issues.map(issue => (
        <AdvancedMarker 
          key={issue.issue_id} 
          position={{ lat: issue.lat, lng: issue.lng }}
          onClick={() => navigate(`/issue/${issue.issue_id}`)}
        >
          <Pin 
            background={getPinColor(issue.severity_score)}
            borderColor="#ffffff"
            glyphColor="#ffffff"
          />
        </AdvancedMarker>
      ))}
    </Map>
  );
}

const MOCK_ISSUES: Issue[] = [
  {
    issue_id: 'mock_1',
    category: 'pothole',
    auto_title: 'Severe Pothole near Central Crossing',
    auto_description: 'Large crater in the middle of the road causing traffic slowdowns and hazard to vehicles.',
    lat: 12.9352,
    lng: 77.6245,
    severity_score: 4,
    severity_justification: 'Deep pothole in high-speed travel lane.',
    status: 'Reported',
    report_count: 5,
    priority_score: 4 * Math.log(6),
    created_at: Date.now() - 100000,
    updated_at: Date.now(),
  },
  {
    issue_id: 'mock_2',
    category: 'garbage',
    auto_title: 'Overflowing Waste Bin',
    auto_description: 'Garbage hasn\'t been collected for 3 days, spilling onto the sidewalk and walking lanes.',
    lat: 12.9348,
    lng: 77.6250,
    severity_score: 3,
    severity_justification: 'Sanitary concern and sidewalk obstruction.',
    status: 'In Progress',
    report_count: 8,
    priority_score: 3 * Math.log(9),
    created_at: Date.now() - 200000,
    updated_at: Date.now(),
  },
  {
    issue_id: 'mock_3',
    category: 'streetlight',
    auto_title: 'Main Streetlight Node out',
    auto_description: 'Pitch black pedestrian crossing, dangerous at night.',
    lat: 12.9360,
    lng: 77.6240,
    severity_score: 3,
    severity_justification: 'Safety hazard during night hours.',
    status: 'Acknowledged',
    report_count: 2,
    priority_score: 3 * Math.log(3),
    created_at: Date.now() - 300000,
    updated_at: Date.now(),
  },
  {
    issue_id: 'mock_4',
    category: 'water_leakage',
    auto_title: 'Major Water Line Burst',
    auto_description: 'Pipeline burst spraying clean water onto the street and flooding the curb.',
    lat: 28.6150,
    lng: 77.2100,
    severity_score: 5,
    severity_justification: 'Immediate flooding hazard and massive clean water wastage.',
    status: 'Reported',
    report_count: 12,
    priority_score: 5 * Math.log(13),
    created_at: Date.now() - 400000,
    updated_at: Date.now(),
  }
];

export function MapView() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const navigate = useNavigate();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const q = query(collection(db, 'issues'), where('status', '!=', 'Archived'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        issue_id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesData);
    }, (err) => {
      console.warn("[Firestore] Map issues query failed (billing expired fallback):", err);
      setIssues(MOCK_ISSUES);
    });
    return () => unsubscribe();
  }, []);

  const getPinColor = (severity: number) => {
    if (severity >= 4) return '#ef4444'; // Red
    if (severity === 3) return '#f59e0b'; // Amber
    return '#3b82f6'; // Blue
  };

  if (!apiKey) {
    return (
      <div className="p-12 text-center text-slate-500">
        Google Maps API key is required. Please set VITE_GOOGLE_MAPS_API_KEY in the Secrets panel.
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] w-full rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl relative">
      <APIProvider apiKey={apiKey}>
        <MapContent issues={issues} navigate={navigate} getPinColor={getPinColor} />
      </APIProvider>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-[#1C1D26]/90 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-800/60 text-xs font-medium space-y-2.5 z-10 text-slate-300">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Critical (4-5)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Moderate (3)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Minor (1-2)</span>
        </div>
      </div>
    </div>
  );
}
