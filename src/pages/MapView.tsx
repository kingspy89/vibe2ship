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
