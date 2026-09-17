"use client";

import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useOwnProfile } from "@/lib/data/members";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/profile/photo-upload";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { data: user } = useCurrentUser();
  const { data: profile } = useOwnProfile(user?.memberId);
  if (!user || !profile) return null;

  return (
    <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-muted-foreground">
          You can edit your details and password here. BS ID and email are
          managed by your Team Coordinator or an admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUpload currentPhoto={profile.photo} fullName={profile.full_name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>Editable by you.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record details</CardTitle>
          <CardDescription>Read-only — contact your Coordinator to correct these.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Email" value={profile.email} />
          <Field label="BS ID" value={profile.bs_id} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Badge variant={profile.status === "active" ? "default" : "secondary"}>
              {profile.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
