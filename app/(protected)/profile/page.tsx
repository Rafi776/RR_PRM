import { getCurrentUser } from "@/lib/data/session";
import { getOwnProfile } from "@/lib/data/members";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/profile/photo-upload";
import { PhoneForm } from "@/components/profile/phone-form";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await getOwnProfile(user.id);
  if (!profile) return null;

  return (
    <div className="max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-muted-foreground">
          You can update your photo and phone number here. Other fields are
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
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <PhoneForm currentPhone={profile.phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record details</CardTitle>
          <CardDescription>Read-only — contact your Coordinator to correct these.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Full name" value={profile.full_name} />
          <Field label="Email" value={profile.email} />
          <Field label="BS ID" value={profile.bs_id} />
          <Field label="Stage" value={profile.stage} />
          <Field label="Scout Group" value={profile.scout_group} />
          <Field label="District" value={profile.district} />
          <Field label="Team" value={profile.team_name} />
          <Field label="Position" value={profile.position} />
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
