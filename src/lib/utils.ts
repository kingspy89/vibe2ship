import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface HotspotInfo {
  is_hotspot: boolean;
  cluster_id?: string;
  cluster_size: number;
  cluster_label?: string;
}

export function computeDBSCANHotspots(issues: any[], maxDistanceMeters: number = 300): Record<string, HotspotInfo> {
  const resultMap: Record<string, HotspotInfo> = {};
  if (!issues || issues.length === 0) return resultMap;

  const n = issues.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const lat1 = issues[i].lat;
      const lng1 = issues[i].lng;
      const lat2 = issues[j].lat;
      const lng2 = issues[j].lng;
      
      if (typeof lat1 === 'number' && typeof lng1 === 'number' && typeof lat2 === 'number' && typeof lng2 === 'number') {
        const dist = calculateHaversineDistance(lat1, lng1, lat2, lng2);
        if (dist <= maxDistanceMeters) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
  }

  const visited = new Array(n).fill(false);
  let clusterCount = 0;

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const clusterMembers: number[] = [];
      const queue: number[] = [i];
      visited[i] = true;

      while (queue.length > 0) {
        const node = queue.shift()!;
        clusterMembers.push(node);

        for (const neighbor of adj[node]) {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        }
      }

      if (clusterMembers.length >= 2) {
        clusterCount++;
        const clusterId = `Cluster #${clusterCount}`;
        const label = `🔥 Hotspot Cluster (${clusterMembers.length} Nearby Tickets)`;

        for (const memberIdx of clusterMembers) {
          const issueId = issues[memberIdx].issue_id || issues[memberIdx].id;
          if (issueId) {
            resultMap[issueId] = {
              is_hotspot: true,
              cluster_id: clusterId,
              cluster_size: clusterMembers.length,
              cluster_label: label
            };
          }
        }
      } else {
        const issueId = issues[i].issue_id || issues[i].id;
        if (issueId) {
          resultMap[issueId] = {
            is_hotspot: false,
            cluster_size: 1
          };
        }
      }
    }
  }

  return resultMap;
}
