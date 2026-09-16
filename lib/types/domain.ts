export type MemberStatus = "active" | "inactive";
export type NocStatus = "pending" | "approved" | "rejected";
export type TaskStatus = "not_submitted" | "submitted" | "selected" | "rejected";
export type MeetingScope = "central_core" | "team";
export type AttendanceStatus = "present" | "absent" | "excused";
export type RoleName =
  | "Super Admin"
  | "Core Team"
  | "Team Coordinator"
  | "Deputy Coordinator"
  | "Member";

export type Team = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_core_team: boolean;
  created_at: string;
};

export type Member = {
  id: string;
  bs_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  stage: string | null;
  scout_group: string | null;
  district: string | null;
  team_name: string | null;
  position: string | null;
  status: MemberStatus;
  joined_at: string;
};

export type TeamMembership = {
  id: string;
  team_id: string;
  member_id: string;
  is_coordinator: boolean;
  is_deputy_coordinator: boolean;
  core_role: string | null;
  is_auto_synced: boolean;
  joined_at: string;
};

export type NocSubmission = {
  id: string;
  member_id: string;
  file_path: string;
  file_name: string;
  status: NocStatus;
  submitted_at: string;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
};

export type TaskType = {
  id: string;
  name: string;
  default_points: number;
};

export type TeamTask = {
  id: string;
  team_id: string | null;
  task_type_id: string | null;
  title: string;
  description: string | null;
  points: number;
  due_date: string | null;
  created_at: string;
};

export type TaskMemberStatus = {
  id: string;
  task_id: string;
  member_id: string;
  status: TaskStatus;
  submission_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export type MeetingMinutes = {
  id: string;
  scope: MeetingScope;
  team_id: string | null;
  title: string;
  meeting_date: string;
  agenda: string | null;
  summary: string | null;
  attachment_url: string | null;
  created_at: string;
};

export type MeetingAttendance = {
  id: string;
  meeting_id: string;
  member_id: string;
  status: AttendanceStatus;
};

export type PerformanceRow = {
  member_id: string;
  full_name: string;
  email: string;
  task_score: number;
  attendance_score: number;
  total_score: number;
  global_rank: number;
};

export type TeamPerformanceRow = PerformanceRow & {
  team_id: string;
  team_name: string;
  team_rank: number;
};
