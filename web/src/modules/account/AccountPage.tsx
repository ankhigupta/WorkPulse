import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { ErrorState, LoadingState } from "../../components/States";
import { PageHeader, SplitGrid } from "../../components/Layout";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { getCurrentUser } from "../../api/auth";
import { useAuthStore } from "../../stores/authStore";
import { errorMessage } from "../../types/api";
import { formatDate, roleLabel } from "../../utils/format";
import styles from "./Account.module.css";

export function AccountPage() {
  const logout = useAuthStore((state) => state.logout);
  const meQuery = useQuery({ queryKey: ["me"], queryFn: getCurrentUser });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Account" />

      <SplitGrid>
        <Card>
          <CardHeader title="Profile" />
          {meQuery.isPending ? (
            <LoadingState />
          ) : meQuery.isError ? (
            <ErrorState message={errorMessage(meQuery.error)} onRetry={() => void meQuery.refetch()} />
          ) : (
            <dl className={styles.details}>
              <div className={styles.detailRow}>
                <dt>Email</dt>
                <dd>{meQuery.data.email}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Role</dt>
                <dd>{roleLabel(meQuery.data.role)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Status</dt>
                <dd>
                  <StatusBadge
                    label={meQuery.data.isActive ? "Active" : "Inactive"}
                    tone={activeTone(meQuery.data.isActive)}
                  />
                </dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Member since</dt>
                <dd>{formatDate(meQuery.data.createdAt)}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card>
          <CardHeader title="Session" subtitle="Signing out revokes this browser's session on the server" />
          <Button variant="destructive" onClick={() => void logout()}>
            Sign out
          </Button>
        </Card>
      </SplitGrid>
    </>
  );
}
