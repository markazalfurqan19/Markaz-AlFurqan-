import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  AdminRole,
  AdminRoleType,
  AuditAction,
  AuditLog,
  AuditTargetType,
  CenterSetting,
  Contribution,
  HARDCODED_OWNER_EMAILS,
  Member,
  SCHEMA_LIMITS,
  getCurrentEthiopianDate,
  sanitizeDocId,
} from './types';
import { Language, TRANSLATIONS } from './i18n';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { PWAInstallButton } from './components/PWAInstallButton';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { ContributionsView } from './components/ContributionsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { MemberModal } from './components/MemberModal';
import { ContributionModal } from './components/ContributionModal';

type ActiveTab = 'dashboard' | 'members' | 'contributions' | 'reports' | 'settings';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [roleResolved, setRoleResolved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [admins, setAdmins] = useState<AdminRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('alfurqaan_lang');
    return saved === 'en' ? 'en' : 'om';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('alfurqaan_theme') === 'dark';
  });

  const [centerSettings, setCenterSettings] = useState<CenterSetting>({
    centerName: TRANSLATIONS.om.centerDefaultName,
    phone: '',
    email: 'markazalfurqan19@gmail.com',
    bankAccountDetails: '',
    bankInfoImage: '',
    monthlyTargetETB: 50000,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [preselectedMember, setPreselectedMember] = useState<Member | null>(null);

  const isOnline = useOnlineStatus();
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    localStorage.setItem('alfurqaan_lang', lang);
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('alfurqaan_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('alfurqaan_theme', 'light');
    }
  }, [darkMode]);

  // 1. Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setRoleResolved(false);
        setIsOwner(false);
        setIsAdmin(false);
        setMembers([]);
        setContributions([]);
        setAdmins([]);
        setAuditLogs([]);
      }
    });
    return () => unsub();
  }, []);

  // 2. Role Resolution (runs once auth is ready and user is signed in)
  useEffect(() => {
    if (!authReady || !user) return;
    const currentUser = user;
    let active = true;
    const email = (currentUser.email || '').toLowerCase();

    async function checkRoles() {
      const hardcoded = (HARDCODED_OWNER_EMAILS as readonly string[]).includes(email);
      if (hardcoded) {
        if (active) {
          setIsOwner(true);
          setIsAdmin(true);
          setRoleResolved(true);
        }
        return;
      }

      try {
        const byEmailSnap = email ? await getDoc(doc(db, 'admins', email)) : null;
        const byUidSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        const roleData =
          (byEmailSnap?.exists() ? (byEmailSnap.data() as AdminRole) : null) ||
          (byUidSnap.exists() ? (byUidSnap.data() as AdminRole) : null);

        if (active) {
          const ownerFlag = roleData?.role === 'owner';
          const adminFlag = ownerFlag || roleData?.role === 'admin';
          setIsOwner(ownerFlag);
          setIsAdmin(adminFlag);
          setRoleResolved(true);
        }
      } catch {
        if (active) {
          setIsOwner(false);
          setIsAdmin(false);
          setRoleResolved(true);
        }
      }
    }

    void checkRoles();
    return () => {
      active = false;
    };
  }, [authReady, user]);

  // 3. Firestore Real-Time Listeners (strictly after authReady && user && roleResolved)
  useEffect(() => {
    if (!authReady || !user || !roleResolved) return;
    setDataLoading(true);

    const membersQuery = isAdmin
      ? collection(db, 'members')
      : query(collection(db, 'members'), where('createdBy', '==', user.uid));

    const contributionsQuery = isAdmin
      ? collection(db, 'contributions')
      : query(collection(db, 'contributions'), where('recordedBy', '==', user.uid));

    let membersLoaded = false;
    let contribLoaded = false;
    const checkDone = () => {
      if (membersLoaded && contribLoaded) setDataLoading(false);
    };

    const unsubMembers = onSnapshot(
      membersQuery,
      (snap) => {
        const list: Member[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<Member, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => a.memberId.localeCompare(b.memberId));
        setMembers(list);
        membersLoaded = true;
        checkDone();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members')
    );

    const unsubContributions = onSnapshot(
      contributionsQuery,
      (snap) => {
        const list: Contribution[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<Contribution, 'id'>),
          id: d.id,
        }));
        setContributions(list);
        contribLoaded = true;
        checkDone();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'contributions')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'center'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CenterSetting;
          setCenterSettings({
            centerName: data.centerName || TRANSLATIONS.om.centerDefaultName,
            phone: data.phone || '',
            email: data.email || '',
            bankAccountDetails: data.bankAccountDetails || '',
            bankInfoImage: data.bankInfoImage || '',
            monthlyTargetETB: data.monthlyTargetETB ?? 50000,
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/center')
    );

    let unsubAdmins: (() => void) | undefined;
    if (isOwner) {
      unsubAdmins = onSnapshot(
        collection(db, 'admins'),
        (snap) => {
          const list: AdminRole[] = snap.docs.map((d) => ({
            ...(d.data() as Omit<AdminRole, 'id'>),
            id: d.id,
          }));
          setAdmins(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'admins')
      );
    }

    const auditQuery = isAdmin
      ? query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100))
      : query(collection(db, 'audit_logs'), where('actorUid', '==', user.uid), limit(100));

    const unsubAuditLogs = onSnapshot(
      auditQuery,
      (snap) => {
        const list: AuditLog[] = snap.docs.map((d) => {
          const raw = d.data() as {
            action: AuditAction;
            targetType: AuditTargetType;
            targetId: string;
            targetLabel: string;
            details?: string;
            actorUid: string;
            actorEmail: string;
            actorName?: string;
            timestamp?: Timestamp | { toDate?: () => Date } | string | null;
          };
          let createdAt = '';
          if (raw.timestamp && typeof raw.timestamp === 'object' && 'toDate' in raw.timestamp && typeof raw.timestamp.toDate === 'function') {
            createdAt = raw.timestamp.toDate().toISOString();
          } else if (typeof raw.timestamp === 'string') {
            createdAt = raw.timestamp;
          }
          return {
            id: d.id,
            action: raw.action,
            targetType: raw.targetType,
            targetId: raw.targetId,
            targetLabel: raw.targetLabel,
            details: raw.details,
            actorUid: raw.actorUid,
            actorEmail: raw.actorEmail,
            actorName: raw.actorName,
            createdAt,
          };
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setAuditLogs(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'audit_logs')
    );

    return () => {
      unsubMembers();
      unsubContributions();
      unsubSettings();
      unsubAuditLogs();
      if (unsubAdmins) unsubAdmins();
    };
  }, [authReady, user, roleResolved, isAdmin, isOwner]);

  const suggestedMemberCode = useMemo(() => {
    const nextNum = members.length + 1;
    return `ALF-M-${String(nextNum).padStart(3, '0')}`;
  }, [members.length]);

  const suggestedReceiptNo = useMemo(() => {
    const { year } = getCurrentEthiopianDate();
    const nextSeq = contributions.length + 1;
    return `ALF-REC-${year}-${String(nextSeq).padStart(4, '0')}`;
  }, [contributions.length]);

  const buildAuditPayload = (params: {
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    targetLabel: string;
    details?: string;
  }) => {
    if (!user) return null;
    const actorEmail = (user.email || user.uid).slice(0, SCHEMA_LIMITS.AUDIT_ACTOR_EMAIL);
    const actorName = (user.displayName || actorEmail).slice(0, SCHEMA_LIMITS.AUDIT_ACTOR_NAME);
    return {
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId.slice(0, SCHEMA_LIMITS.AUDIT_TARGET_ID) || 'unknown',
      targetLabel: params.targetLabel.slice(0, SCHEMA_LIMITS.AUDIT_TARGET_LABEL) || 'Record',
      details: (params.details || '').slice(0, SCHEMA_LIMITS.AUDIT_DETAILS),
      actorUid: user.uid.slice(0, SCHEMA_LIMITS.AUDIT_ACTOR_UID),
      actorEmail,
      actorName,
      timestamp: serverTimestamp(),
    };
  };

  const recordAuditLog = async (params: {
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    targetLabel: string;
    details?: string;
  }) => {
    const payload = buildAuditPayload(params);
    if (!payload) return;
    const logId = sanitizeDocId(`log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
    const path = `audit_logs/${logId}`;
    try {
      await setDoc(doc(db, 'audit_logs', logId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  // Firestore Mutations
  const handleSaveMember = async (
    data: Omit<Member, 'id' | 'halqa' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const now = new Date().toISOString();

    if (editingMember) {
      const path = `members/${editingMember.id}`;
      try {
        await updateDoc(doc(db, 'members', editingMember.id), {
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          email: data.email || '',
          monthlyPledgeETB: data.monthlyPledgeETB,
          status: data.status,
          category: data.category || 'supporter',
          city: data.city || '',
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      await recordAuditLog({
        action: 'member_updated',
        targetType: 'member',
        targetId: editingMember.memberId,
        targetLabel: data.fullName,
        details: `${data.category || 'supporter'} · ${data.status} · ${data.monthlyPledgeETB} ETB`,
      });
    } else {
      const docId = sanitizeDocId(`${data.memberId}-${Date.now().toString(36)}`);
      const path = `members/${docId}`;
      try {
        await setDoc(doc(db, 'members', docId), {
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          email: data.email || '',
          memberId: data.memberId,
          monthlyPledgeETB: data.monthlyPledgeETB,
          status: data.status,
          category: data.category || 'supporter',
          city: data.city || '',
          createdBy: user.uid,
          createdByEmail: (user.email || '').slice(0, SCHEMA_LIMITS.ADMIN_EMAIL),
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      await recordAuditLog({
        action: 'member_created',
        targetType: 'member',
        targetId: data.memberId,
        targetLabel: data.fullName,
        details: `${data.category || 'supporter'} · ${data.phoneNumber} · ${data.monthlyPledgeETB} ETB`,
      });
    }
  };

  const handleDeleteMember = async (member: Member) => {
    const path = `members/${member.id}`;
    try {
      await deleteDoc(doc(db, 'members', member.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    await recordAuditLog({
      action: 'member_deleted',
      targetType: 'member',
      targetId: member.memberId,
      targetLabel: member.fullName,
      details: `${member.phoneNumber} · ${member.status}`,
    });
  };

  const generateSequentialReceiptNo = (baseReceipt: string, offset: number): string => {
    if (offset === 0) return baseReceipt;
    const match = baseReceipt.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const nextVal = String(Number(numStr) + offset).padStart(numStr.length, '0');
      return `${prefix}${nextVal}`.slice(0, SCHEMA_LIMITS.CONTRIBUTION_RECEIPT);
    }
    return `${baseReceipt}-${offset + 1}`.slice(0, SCHEMA_LIMITS.CONTRIBUTION_RECEIPT);
  };

  const handleSaveContribution = async (
    data: Omit<Contribution, 'id' | 'recordedBy' | 'createdAt' | 'updatedAt'> & {
      ethiopianMonths?: string[];
    }
  ) => {
    if (!user) return;
    const now = new Date().toISOString();

    if (editingContribution) {
      const path = `contributions/${editingContribution.id}`;
      try {
        await updateDoc(doc(db, 'contributions', editingContribution.id), {
          amountETB: data.amountETB,
          ethiopianMonth: data.ethiopianMonth,
          ethiopianYear: data.ethiopianYear,
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference || '',
          proofFileUrl: data.proofFileUrl || '',
          proofFileName: data.proofFileName || '',
          notes: data.notes || '',
          status: data.status,
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      await recordAuditLog({
        action: 'contribution_updated',
        targetType: 'contribution',
        targetId: editingContribution.receiptNumber,
        targetLabel: editingContribution.memberName,
        details: `${data.amountETB} ETB · ${data.ethiopianMonth} ${data.ethiopianYear} · ${data.status}`,
      });
      return;
    }

    const monthsToSave =
      data.ethiopianMonths && data.ethiopianMonths.length > 0
        ? data.ethiopianMonths
        : [data.ethiopianMonth];

    if (monthsToSave.length === 1) {
      const docId = sanitizeDocId(`${data.receiptNumber}-${Date.now().toString(36)}`);
      const path = `contributions/${docId}`;
      try {
        await setDoc(doc(db, 'contributions', docId), {
          memberId: data.memberId,
          memberName: data.memberName,
          receiptNumber: data.receiptNumber,
          amountETB: data.amountETB,
          ethiopianMonth: monthsToSave[0],
          ethiopianYear: data.ethiopianYear,
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference || '',
          proofFileUrl: data.proofFileUrl || '',
          proofFileName: data.proofFileName || '',
          notes: data.notes || '',
          recordedBy: user.uid,
          status: data.status,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      await recordAuditLog({
        action: 'contribution_created',
        targetType: 'contribution',
        targetId: data.receiptNumber,
        targetLabel: data.memberName,
        details: `${data.amountETB} ETB · ${monthsToSave[0]} ${data.ethiopianYear} · ${data.paymentMethod}`,
      });
      return;
    }

    const batch = writeBatch(db);
    const stamp = Date.now().toString(36);
    monthsToSave.forEach((month, idx) => {
      const recNo = generateSequentialReceiptNo(data.receiptNumber, idx);
      const docId = sanitizeDocId(`${recNo}-${stamp}-${idx}`);
      batch.set(doc(db, 'contributions', docId), {
        memberId: data.memberId,
        memberName: data.memberName,
        receiptNumber: recNo,
        amountETB: data.amountETB,
        ethiopianMonth: month.slice(0, SCHEMA_LIMITS.CONTRIBUTION_MONTH),
        ethiopianYear: data.ethiopianYear,
        paymentMethod: data.paymentMethod,
        transactionReference: data.transactionReference || '',
        proofFileUrl: data.proofFileUrl || '',
        proofFileName: data.proofFileName || '',
        notes: data.notes || '',
        recordedBy: user.uid,
        status: data.status,
        createdAt: now,
        updatedAt: now,
      });
    });

    const batchAuditPayload = buildAuditPayload({
      action: 'contribution_created',
      targetType: 'contribution',
      targetId: data.receiptNumber,
      targetLabel: data.memberName,
      details: `${monthsToSave.length} months (${monthsToSave.join(', ')}) · ${data.amountETB} ETB/mo · ${data.ethiopianYear}`,
    });
    if (batchAuditPayload) {
      const auditId = sanitizeDocId(`log-${stamp}-${Math.random().toString(36).slice(2, 7)}`);
      batch.set(doc(db, 'audit_logs', auditId), batchAuditPayload);
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'contributions');
    }
  };

  const handleQuickVerifyContribution = async (c: Contribution) => {
    const path = `contributions/${c.id}`;
    try {
      await updateDoc(doc(db, 'contributions', c.id), {
        status: 'verified',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
    await recordAuditLog({
      action: 'contribution_verified',
      targetType: 'contribution',
      targetId: c.receiptNumber,
      targetLabel: c.memberName,
      details: `${c.amountETB} ETB · ${c.ethiopianMonth} ${c.ethiopianYear}`,
    });
  };

  const handleDeleteContribution = async (c: Contribution) => {
    const path = `contributions/${c.id}`;
    try {
      await deleteDoc(doc(db, 'contributions', c.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    await recordAuditLog({
      action: 'contribution_deleted',
      targetType: 'contribution',
      targetId: c.receiptNumber,
      targetLabel: c.memberName,
      details: `${c.amountETB} ETB · ${c.ethiopianMonth} ${c.ethiopianYear}`,
    });
  };

  const handleSaveSettings = async (data: CenterSetting) => {
    if (!user) return;
    const path = 'settings/center';
    try {
      await setDoc(doc(db, 'settings', 'center'), {
        centerName: data.centerName,
        phone: data.phone || '',
        email: data.email || '',
        bankAccountDetails: data.bankAccountDetails || '',
        bankInfoImage: data.bankInfoImage || '',
        monthlyTargetETB: data.monthlyTargetETB ?? 0,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    await recordAuditLog({
      action: 'settings_updated',
      targetType: 'settings',
      targetId: 'center',
      targetLabel: data.centerName,
      details: `Target: ${data.monthlyTargetETB ?? 0} ETB${data.bankInfoImage ? ' · Bank image attached' : ''}`,
    });
  };

  const handleGrantAdmin = async (email: string, role: AdminRoleType) => {
    if (!user) return;
    const cleanEmail = email.trim().toLowerCase().slice(0, SCHEMA_LIMITS.ADMIN_EMAIL);
    const path = `admins/${cleanEmail}`;
    try {
      await setDoc(doc(db, 'admins', cleanEmail), {
        email: cleanEmail,
        role,
        grantedBy: (user.email || user.uid).slice(0, SCHEMA_LIMITS.ADMIN_EMAIL),
        grantedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    await recordAuditLog({
      action: 'admin_granted',
      targetType: 'admin',
      targetId: cleanEmail,
      targetLabel: cleanEmail,
      details: `Role granted: ${role.toUpperCase()}`,
    });
  };

  const handleRevokeAdmin = async (adminId: string) => {
    const targetAdmin = admins.find((a) => a.id === adminId);
    const path = `admins/${adminId}`;
    try {
      await deleteDoc(doc(db, 'admins', adminId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    await recordAuditLog({
      action: 'admin_revoked',
      targetType: 'admin',
      targetId: adminId,
      targetLabel: targetAdmin?.email || adminId,
      details: `Revoked ${targetAdmin ? targetAdmin.role.toUpperCase() : 'admin'} role`,
    });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8FC] dark:bg-[#060E1F]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-[#1B3158] border-t-[#0B1F3A] dark:border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === 'om' ? 'en' : 'om'))}
      />
    );
  }

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'members', label: t.nav.members, icon: <Users className="w-4 h-4" /> },
    { id: 'contributions', label: t.nav.contributions, icon: <CreditCard className="w-4 h-4" /> },
    { id: 'reports', label: t.nav.reports, icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: t.nav.settings, icon: <Settings className="w-4 h-4" /> },
  ];

  const roleLabel = isOwner ? t.roles.owner : isAdmin ? t.roles.admin : t.roles.recorder;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-[#0B1933] border-r border-slate-200 dark:border-[#1B3158]">
      <div className="p-5 space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Logo"
              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t.appName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {t.appSubtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#13294E]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0B1F3A] text-white dark:bg-blue-700'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <PWAInstallButton label={t.actions.installApp} />
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-[#1B3158] space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? t.theme.deepBlue : t.theme.midnight}</span>
          </button>
          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'om' ? 'en' : 'om'))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E] shrink-0"
          >
            {lang === 'om' ? 'EN' : 'OM'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Profile"
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.displayName || user.email}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {roleLabel}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            title={t.actions.signOut}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F6F8FC] dark:bg-[#060E1F] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#060E1F]/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B1933]/95 backdrop-blur-xs border-b border-slate-200 dark:border-[#1B3158] px-6 py-3.5 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-slate-700 dark:text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <img
                src="/assets/aistudio/loog_6003b99d.jpg"
                alt="Al-Furqaan"
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0 hidden sm:block"
              />
              <span className="font-semibold text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                {centerSettings.centerName}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
                {navItems.find((n) => n.id === activeTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingContribution(null);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.recordPayment}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              members={members}
              contributions={contributions}
              centerSettings={centerSettings}
              loading={dataLoading}
              lang={lang}
              onOpenNewContribution={() => {
                setEditingContribution(null);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              onOpenNewMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'members' && (
            <MembersView
              members={members}
              contributions={contributions}
              centerSettings={centerSettings}
              loading={dataLoading}
              isAdmin={isAdmin}
              lang={lang}
              onAddMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
              onDeleteMember={handleDeleteMember}
              onRecordForMember={(member) => {
                setEditingContribution(null);
                setPreselectedMember(member);
                setContributionModalOpen(true);
              }}
            />
          )}

          {activeTab === 'contributions' && (
            <ContributionsView
              contributions={contributions}
              centerSettings={centerSettings}
              loading={dataLoading}
              isAdmin={isAdmin}
              lang={lang}
              onAddContribution={() => {
                setEditingContribution(null);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              onEditContribution={(c) => {
                setEditingContribution(c);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              onQuickVerify={handleQuickVerifyContribution}
              onDeleteContribution={handleDeleteContribution}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              members={members}
              contributions={contributions}
              centerSettings={centerSettings}
              lang={lang}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              centerSettings={centerSettings}
              admins={admins}
              auditLogs={auditLogs}
              isAdmin={isAdmin}
              isOwner={isOwner}
              currentUserEmail={(user.email || '').toLowerCase()}
              lang={lang}
              onSaveSettings={handleSaveSettings}
              onGrantAdmin={handleGrantAdmin}
              onRevokeAdmin={handleRevokeAdmin}
            />
          )}
        </main>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>{t.labels.offlineBanner}</span>
        </div>
      )}

      {/* Modals */}
      <MemberModal
        isOpen={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        onSave={handleSaveMember}
        editingMember={editingMember}
        suggestedCode={suggestedMemberCode}
        lang={lang}
      />

      <ContributionModal
        isOpen={contributionModalOpen}
        onClose={() => setContributionModalOpen(false)}
        onSave={handleSaveContribution}
        members={members}
        centerSettings={centerSettings}
        editingContribution={editingContribution}
        preselectedMember={preselectedMember}
        suggestedReceiptNo={suggestedReceiptNo}
        lang={lang}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
