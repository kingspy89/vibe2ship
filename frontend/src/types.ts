export type IssueCategory = 'pothole' | 'streetlight' | 'garbage' | 'water_leakage' | 'other';
export type IssueStatus = 'Reported' | 'Community Verified' | 'Acknowledged' | 'In Progress' | 'Resolved';

export interface Issue {
  issue_id: string;
  category: IssueCategory;
  auto_title: string;
  auto_description: string;
  lat: number;
  lng: number;
  severity_score: number;
  severity_justification: string;
  status: IssueStatus;
  report_count: number;
  priority_score: number;
  created_at: number;
  updated_at: number;
  resolved_photo_url?: string;
  resolution_notes?: string;
  estimated_dimensions?: string;
  traffic_impact?: string;
  safety_hazard_level?: string;
  risk_factors?: string[];
}

export interface Report {
  report_id: string;
  issue_id: string;
  user_id: string;
  photo_url: string;
  raw_caption?: string;
  created_at: number;
}

export interface Verification {
  verification_id: string;
  issue_id: string;
  user_id: string;
  type: 'confirm' | 'already_fixed' | 'not_accurate';
  created_at: number;
}

export interface UserProfile {
  user_id: string;
  display_name: string;
  role: 'citizen' | 'admin';
  points: number;
  reports_count: number;
  verifications_count: number;
}
