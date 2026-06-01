import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Section from '../../components/common/Section';
import EmptyState from '../../components/common/EmptyState';
import {
  getMyFirm,
  listFirmInvitations,
  listFirmMembers,
} from '../../services/firmService';
import { displayName } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProFirmScreen() {
  const [firm, setFirm] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, inv] = await Promise.all([
        getMyFirm().catch(() => null),
        listFirmInvitations().catch(() => []),
      ]);
      const firmRow = f && (f.firm || f);
      setFirm(firmRow);
      if (firmRow && firmRow.id) {
        const m = await listFirmMembers(firmRow.id).catch(() => []);
        setMembers(m);
      } else {
        setMembers([]);
      }
      setInvitations(inv || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer refreshing={loading} onRefresh={load}>
      {invitations.length > 0 ? (
        <Section title="Pending invitations">
          {invitations.map((inv) => (
            <Card key={inv.id} style={{ marginBottom: spacing.sm }}>
              <Text style={styles.title}>
                {inv.firmName || 'Firm invitation'}
              </Text>
              <Text style={styles.muted}>
                Role: {inv.role || 'member'}
                {inv.invitedByName ? ` · from ${inv.invitedByName}` : ''}
              </Text>
              <Text style={styles.muted}>
                Accept this invitation from the web app to join the firm.
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}

      {!firm ? (
        <EmptyState
          icon="briefcase"
          title="No firm yet"
          description="Create a firm from the web app, or accept an invitation to join one."
        />
      ) : (
        <>
          <Card>
            <Text style={styles.firmName}>{firm.name}</Text>
            <View style={styles.row}>
              {firm.status ? <Badge variant="green">{firm.status}</Badge> : null}
              {firm.firmType ? <Badge variant="blue">{firm.firmType}</Badge> : null}
            </View>
            {firm.city ? <Text style={styles.muted}>{firm.city}</Text> : null}
          </Card>
          <Section title="Members">
            {members.length === 0 ? (
              <EmptyState
                icon="users"
                title="No team members yet"
                description="Invite professionals from the web app to grow your firm."
              />
            ) : (
              members.map((m) => (
                <Card key={m.id || m.userId} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {displayName(m.user || m)}
                      </Text>
                      <Text style={styles.muted}>{m.email || (m.user && m.user.email)}</Text>
                    </View>
                    {m.role ? <Badge variant="amber">{m.role}</Badge> : null}
                  </View>
                </Card>
              ))
            )}
          </Section>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  firmName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  muted: { marginTop: 4, fontSize: fontSize.sm, color: colors.textSecondary },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
});
